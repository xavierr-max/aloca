using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class RecurringIncomeTests
{
    [Fact]
    public async Task RecurringIncomeWithoutCategoryIsPersistedAndReturnedAsUncategorized()
    {
        await using var db = CreateDbContext();
        var service = new RecurringIncomeService(db);

        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Teste#05", Amount = 100m, CategoryId = null,
            Frequency = RecurringIncomeFrequency.Monthly,
            StartDate = new DateOnly(2026, 9, 21), DayOfMonth = 21
        }, CancellationToken.None);

        Assert.NotNull(created);
        Assert.Null(created!.CategoryId);
        Assert.Null(created.CategoryName);
        Assert.Null((await db.RecurringIncomes.SingleAsync()).CategoryId);
    }

    [Fact]
    public async Task Monthly31_UsesLastValidDayAndDoesNotDuplicateOccurrences()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db);
        var start = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Salário", Amount = 2000m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = start, DayOfMonth = 31 }, CancellationToken.None);
        var loaded = await service.GetAsync(created!.Id, CancellationToken.None);
        var february = loaded!.Occurrences.FirstOrDefault(x => x.ScheduledDate.Month == 2);

        Assert.NotNull(february);
        Assert.Equal(DateTime.DaysInMonth(february.ScheduledDate.Year, 2), february.ScheduledDate.Day);
        Assert.Equal(loaded.Occurrences.Count, (await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences.Count);
    }

    [Fact]
    public async Task ReceivingOccurrenceIsIdempotentAndPauseSuspendsOnlyFutureItems()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Bolsa", Amount = 500m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Weekly, StartDate = today }, CancellationToken.None);
        var occurrence = created!.Occurrences.First();
        var first = await service.ReceiveAsync(occurrence.Id, CancellationToken.None); var second = await service.ReceiveAsync(occurrence.Id, CancellationToken.None);
        await service.SetActiveAsync(created.Id, false, CancellationToken.None);
        var future = created.Occurrences.First(x => x.ScheduledDate > today);

        Assert.Equal(first!.TransactionId, second!.TransactionId);
        Assert.Null(await service.ReceiveAsync(future.Id, CancellationToken.None));
        Assert.Equal(1, await db.Transactions.CountAsync());
        Assert.Contains((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Received);
        Assert.Contains((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Paused);
        Assert.DoesNotContain((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
    }

    [Fact]
    public async Task ReactivatingPausedRecurringIncomeRestoresFutureOccurrencesAndNextOccurrence()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Salário", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day }, CancellationToken.None);

        await service.SetActiveAsync(created!.Id, false, CancellationToken.None);
        Assert.Null((await service.GetAsync(created.Id, CancellationToken.None))!.NextOccurrence);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);

        var restored = await service.GetAsync(created.Id, CancellationToken.None);
        Assert.True(restored!.IsActive);
        Assert.NotNull(restored.NextOccurrence);
        Assert.All(restored.Occurrences.Where(x => x.ScheduledDate >= today && x.ScheduledDate > today), x => Assert.Equal(RecurringIncomeOccurrenceStatus.Planned, x.Status));
    }

    [Fact]
    public async Task ReactivationDoesNotRestorePastPausedOccurrencesAsFuture()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Salário", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day }, CancellationToken.None);
        var occurrence = await db.RecurringIncomeOccurrences.OrderBy(x => x.ScheduledDate).Skip(1).FirstAsync();
        db.Entry(occurrence).Property(x => x.ScheduledDate).CurrentValue = today.AddDays(-1);
        await db.SaveChangesAsync();

        await service.SetActiveAsync(created!.Id, false, CancellationToken.None);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);

        var result = await service.GetAsync(created.Id, CancellationToken.None);
        Assert.DoesNotContain(result!.Occurrences, x => x.ScheduledDate < today && x.Status == RecurringIncomeOccurrenceStatus.Planned);
        Assert.NotNull(result.NextOccurrence);
        Assert.True(result.NextOccurrence >= today);
    }

    [Fact]
    public async Task ReactivationNearEndDateRestoresOnlyOccurrencesInsideValidPeriod()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var end = today.AddMonths(2);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Contrato", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, EndDate = end, DayOfMonth = today.Day }, CancellationToken.None);

        await service.SetActiveAsync(created!.Id, false, CancellationToken.None);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);

        var result = await service.GetAsync(created.Id, CancellationToken.None);
        Assert.All(result!.Occurrences, x => Assert.True(x.ScheduledDate <= end));
        Assert.NotNull(result.NextOccurrence);
        Assert.True(result.NextOccurrence <= end);
    }

    [Fact]
    public async Task RepeatedPauseAndReactivateDoesNotCreateDuplicates()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Salário", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day }, CancellationToken.None);
        var initialCount = await db.RecurringIncomeOccurrences.CountAsync();

        await service.SetActiveAsync(created!.Id, false, CancellationToken.None);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);
        await service.SetActiveAsync(created.Id, false, CancellationToken.None);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);
        await service.EnsureOccurrencesAsync(today.AddMonths(24), CancellationToken.None);

        Assert.Equal(initialCount, await db.RecurringIncomeOccurrences.CountAsync());
        Assert.Equal(initialCount, await db.RecurringIncomeOccurrences.Select(x => x.ScheduledDate).Distinct().CountAsync());
    }

    [Fact]
    public async Task ReceivingMonthlyOccurrenceRemovesOnlyThatOccurrenceFromProjection()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var service = new RecurringIncomeService(db);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Mesada", Amount = 80m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day
        }, CancellationToken.None);

        var first = created!.Occurrences.Single(x => x.ScheduledDate == today);
        await service.ReceiveAsync(first.Id, CancellationToken.None);
        var projection = await new FinancialProjectionService(db, service).GetAsync(3, CancellationToken.None);

        Assert.Equal(160m, projection.TotalProjectedIncome);
        Assert.DoesNotContain(projection.Months.SelectMany(x => x.Incomes), x => x.Id == first.Id.ToString());
        Assert.Single(await db.Transactions.ToListAsync());
        Assert.Equal(80m, (await new FinancialBalanceService(db).GetAsync(CancellationToken.None)).SaldoReal);
    }

    [Fact]
    public async Task ReceivingFutureOccurrenceRecordsItTodayAndKeepsLaterOccurrencesPlanned()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var service = new RecurringIncomeService(db);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Bônus", Amount = 250m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today.AddMonths(1), DayOfMonth = today.Day
        }, CancellationToken.None);

        var future = created!.Occurrences.OrderBy(x => x.ScheduledDate).First(x => x.ScheduledDate > today);
        await service.ReceiveAsync(future.Id, CancellationToken.None);

        var transaction = await db.Transactions.SingleAsync();
        Assert.Equal(today, transaction.Date);
        Assert.Equal(RecurringIncomeOccurrenceStatus.Received,
            (await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences.Single(x => x.Id == future.Id).Status);
        Assert.Contains((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences,
            x => x.Status == RecurringIncomeOccurrenceStatus.Planned && x.ScheduledDate > future.ScheduledDate);
        var projection = await new FinancialProjectionService(db, service).GetAsync(3, CancellationToken.None);
        Assert.DoesNotContain(projection.Months.SelectMany(x => x.Incomes), x => x.Id == future.Id.ToString());
    }

    [Fact]
    public async Task EditingStartDateReschedulesFutureForecastsWithoutCancellingHistory()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Salário", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today
        }, CancellationToken.None);
        var first = created!.Occurrences.Single(x => x.ScheduledDate == today);
        await service.ReceiveAsync(first.Id, CancellationToken.None);

        var result = await service.UpdateAsync(created.Id, new RecurringIncomeRequest
        {
            Description = "Salário", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today.AddDays(1)
        }, CancellationToken.None);

        Assert.Equal(RecurringIncomeOccurrenceStatus.Received, result!.Occurrences.Single(x => x.Id == first.Id).Status);
        Assert.DoesNotContain(result.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
        Assert.Contains(result.Occurrences, x => x.ScheduledDate == today.AddDays(1) && x.Status == RecurringIncomeOccurrenceStatus.Planned);
        Assert.Equal(today.AddDays(1), result.NextOccurrence);
    }

    [Fact]
    public async Task EditingToLaterDateRemovesOldFutureForecastsWithoutCancelledRows()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Contrato", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today
        }, CancellationToken.None);
        var oldFuture = created!.Occurrences.Where(x => x.ScheduledDate > today).Select(x => x.ScheduledDate).ToHashSet();

        var result = await service.UpdateAsync(created.Id, new RecurringIncomeRequest
        {
            Description = "Contrato", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today.AddDays(30)
        }, CancellationToken.None);

        Assert.DoesNotContain(result!.Occurrences, x => oldFuture.Contains(x.ScheduledDate) && x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
        Assert.Contains(result.Occurrences, x => x.ScheduledDate == today.AddDays(30) && x.Status == RecurringIncomeOccurrenceStatus.Planned);
        Assert.Equal(today.AddDays(30), result.NextOccurrence);
    }

    [Fact]
    public async Task EditingFrequencyRegeneratesTheFutureCalendarWithoutDuplicates()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Mesada", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today
        }, CancellationToken.None);

        var result = await service.UpdateAsync(created!.Id, new RecurringIncomeRequest
        {
            Description = "Mesada", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today
        }, CancellationToken.None);

        Assert.Equal(RecurringIncomeFrequency.Monthly, result!.Frequency);
        Assert.Equal(result.Occurrences.Count, result.Occurrences.Select(x => x.ScheduledDate).Distinct().Count());
        Assert.All(result.Occurrences.Where(x => x.ScheduledDate >= today), x => Assert.Equal(RecurringIncomeOccurrenceStatus.Planned, x.Status));
        Assert.Equal(today, result.NextOccurrence);
    }

    [Fact]
    public async Task EditingEndDateRemovesOnlyFutureForecastsOutsideTheNewInterval()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Contrato", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today, EndDate = today.AddDays(30)
        }, CancellationToken.None);

        var result = await service.UpdateAsync(created!.Id, new RecurringIncomeRequest
        {
            Description = "Contrato", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Weekly, StartDate = today, EndDate = today.AddDays(10)
        }, CancellationToken.None);

        Assert.All(result!.Occurrences, x => Assert.True(x.ScheduledDate <= today.AddDays(10)));
        Assert.DoesNotContain(result.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
    }

    [Fact]
    public async Task EditingARecurrenceMultipleTimesDoesNotCreateDuplicates()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Salário", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day
        }, CancellationToken.None);

        for (var index = 1; index <= 3; index++)
            await service.UpdateAsync(created!.Id, new RecurringIncomeRequest
            {
                Description = "Salário", Amount = 100m, CategoryId = category.Id,
                Frequency = index % 2 == 0 ? RecurringIncomeFrequency.Monthly : RecurringIncomeFrequency.Weekly,
                StartDate = today.AddDays(index), DayOfMonth = index % 2 == 0 ? today.Day : null
            }, CancellationToken.None);

        var result = await service.GetAsync(created!.Id, CancellationToken.None);
        Assert.Equal(result!.Occurrences.Count, result.Occurrences.Select(x => x.ScheduledDate).Distinct().Count());
        Assert.DoesNotContain(result.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
    }

    [Fact]
    public async Task ReconcileRepairsLegacyCancelledFutureBatchAndRecomputesNextOccurrence()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = today.AddMonths(1);
        var end = start.AddMonths(7);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Legado corrompido", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = start, EndDate = end, DayOfMonth = start.Day
        }, CancellationToken.None);

        foreach (var occurrence in await db.RecurringIncomeOccurrences.Where(x => x.RecurringIncomeId == created!.Id).ToListAsync())
        {
            occurrence.Cancel();
            db.Entry(occurrence).Property(x => x.CancellationSource).CurrentValue = null;
        }
        await db.SaveChangesAsync();

        var result = await service.UpdateAsync(created!.Id, new RecurringIncomeRequest
        {
            Description = "Legado corrompido", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = start, EndDate = end, DayOfMonth = start.Day
        }, CancellationToken.None);

        var persisted = await db.RecurringIncomeOccurrences.Where(x => x.RecurringIncomeId == created.Id).OrderBy(x => x.ScheduledDate).ToListAsync();
        Assert.Equal(8, persisted.Count);
        Assert.All(persisted, x => Assert.Equal(RecurringIncomeOccurrenceStatus.Planned, x.Status));
        Assert.Equal(start, result!.NextOccurrence);
        Assert.Equal(persisted.Count, persisted.Select(x => x.ScheduledDate).Distinct().Count());
    }

    [Fact]
    public async Task PauseReactivateAndEditReconcilesFutureCalendarAndKeepsReceivedHistory()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Ciclo", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, EndDate = today.AddMonths(8), DayOfMonth = today.Day
        }, CancellationToken.None);
        var received = created!.Occurrences.Single(x => x.ScheduledDate == today);
        await service.ReceiveAsync(received.Id, CancellationToken.None);
        await service.SetActiveAsync(created.Id, false, CancellationToken.None);
        await service.SetActiveAsync(created.Id, true, CancellationToken.None);

        var newStart = today.AddDays(1);
        var result = await service.UpdateAsync(created.Id, new RecurringIncomeRequest
        {
            Description = "Ciclo", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = newStart, EndDate = newStart.AddMonths(4), DayOfMonth = newStart.Day
        }, CancellationToken.None);

        Assert.Equal(RecurringIncomeOccurrenceStatus.Received,
            result!.Occurrences.Single(x => x.Id == received.Id).Status);
        Assert.DoesNotContain(result.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Cancelled);
        Assert.Equal(newStart, result.NextOccurrence);
        Assert.Equal(result.Occurrences.Count, result.Occurrences.Select(x => x.ScheduledDate).Distinct().Count());
    }

    [Fact]
    public async Task ReconcileDoesNotRestoreAnExplicitUserCancellation()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Cancelamento real", Amount = 100m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = today.AddMonths(1), EndDate = today.AddMonths(3), DayOfMonth = today.Day
        }, CancellationToken.None);
        var manual = await db.RecurringIncomeOccurrences.OrderBy(x => x.ScheduledDate).FirstAsync();
        manual.Cancel();
        await db.SaveChangesAsync();

        var result = await service.GetAsync(created!.Id, CancellationToken.None);

        var cancelled = result!.Occurrences.Single(x => x.Id == manual.Id);
        Assert.Equal(RecurringIncomeOccurrenceStatus.Cancelled, cancelled.Status);
        Assert.Equal(RecurringIncomeOccurrenceCancellationSource.User, cancelled.CancellationSource);
        Assert.NotNull(result.NextOccurrence);
    }

    [Fact]
    public async Task DeleteRemovesRecurringIncomeAndOccurrencesButKeepsReceivedTransaction()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Mesada", Amount = 300m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Weekly, StartDate = DateOnly.FromDateTime(DateTime.UtcNow) }, CancellationToken.None);
        var receivedOccurrence = created!.Occurrences.First();
        var received = await service.ReceiveAsync(receivedOccurrence.Id, CancellationToken.None);

        Assert.True(await service.DeleteAsync(created.Id, CancellationToken.None));

        Assert.Equal(0, await db.RecurringIncomes.CountAsync());
        Assert.Equal(0, await db.RecurringIncomeOccurrences.CountAsync());
        var transaction = await db.Transactions.SingleAsync();
        Assert.Equal(received!.TransactionId, transaction.Id);
        Assert.Null(transaction.RecurringIncomeOccurrenceId);
    }

    [Fact]
    public async Task DeletingReceivedOccurrenceTransactionRestoresPlannedOccurrence()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var recurringService = new RecurringIncomeService(db);
        var created = await recurringService.CreateAsync(new RecurringIncomeRequest
        {
            Description = "Mesada", Amount = 300m, CategoryId = category.Id,
            Frequency = RecurringIncomeFrequency.Monthly, StartDate = DateOnly.FromDateTime(DateTime.UtcNow)
        }, CancellationToken.None);
        var occurrence = created!.Occurrences.First();
        var received = await recurringService.ReceiveAsync(occurrence.Id, CancellationToken.None);

        Assert.True(await new TransactionService(db).DeleteAsync(received!.TransactionId!.Value, CancellationToken.None));

        var restored = await db.RecurringIncomeOccurrences.SingleAsync(x => x.Id == occurrence.Id);
        Assert.Equal(RecurringIncomeOccurrenceStatus.Planned, restored.Status);
        Assert.Null(restored.TransactionId);
        Assert.Equal(0, await db.Transactions.CountAsync());
    }

    private static AlocaDbContext CreateDbContext() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase($"recurring-tests-{Guid.NewGuid()}").Options);
}
