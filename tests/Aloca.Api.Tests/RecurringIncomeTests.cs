using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class RecurringIncomeTests
{
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
    public async Task ReceivingOccurrenceIsIdempotentAndPauseCancelsOnlyPlannedItems()
    {
        await using var db = CreateDbContext();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db); var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var created = await service.CreateAsync(new RecurringIncomeRequest { Description = "Bolsa", Amount = 500m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Weekly, StartDate = today }, CancellationToken.None);
        var occurrence = created!.Occurrences.First();
        var first = await service.ReceiveAsync(occurrence.Id, CancellationToken.None); var second = await service.ReceiveAsync(occurrence.Id, CancellationToken.None);
        await service.SetActiveAsync(created.Id, false, CancellationToken.None);

        Assert.Equal(first!.TransactionId, second!.TransactionId);
        Assert.Equal(1, await db.Transactions.CountAsync());
        Assert.Contains((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Received);
        Assert.DoesNotContain((await service.GetAsync(created.Id, CancellationToken.None))!.Occurrences, x => x.Status == RecurringIncomeOccurrenceStatus.Planned);
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
