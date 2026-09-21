using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class AutomaticProcessingTests
{
    [Fact]
    public async Task AutomaticIncomeIsReceivedOnceAndDisabledFutureIncomeIsIgnored()
    {
        await using var db = CreateDb();
        var category = new Category("Renda"); db.Categories.Add(category); await db.SaveChangesAsync();
        var today = BusinessClock.Today();
        var service = new RecurringIncomeService(db);
        var item = await service.CreateAsync(new RecurringIncomeRequest { Description = "Salário", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day, AutomaticProcessing = true }, default);

        Assert.Equal(1, await service.ProcessDueAsync(today, default));
        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        Assert.Equal(1, await db.Transactions.CountAsync());
        Assert.Equal(RecurringIncomeOccurrenceStatus.Received, (await db.RecurringIncomeOccurrences.SingleAsync()).Status);

        await service.UpdateAsync(item!.Id, new RecurringIncomeRequest { Description = "Salário", Amount = 100m, CategoryId = category.Id, Frequency = RecurringIncomeFrequency.Monthly, StartDate = today, DayOfMonth = today.Day, AutomaticProcessing = false }, default);
        Assert.False((await db.RecurringIncomes.SingleAsync()).AutomaticProcessing);
    }

    [Fact]
    public async Task AutomaticCommitmentUsesExistingPaymentFlowAndIsIdempotent()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        var item = new FinancialCommitment("Parcela", 75m, 2, 0, 75m, null, true, today, automaticProcessing: true);
        db.FinancialCommitments.Add(item); await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        Assert.Equal(1, await service.ProcessDueAsync(today, default));
        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        var saved = await db.FinancialCommitments.SingleAsync();
        Assert.Equal(1, saved.PaidInstallments);
        Assert.Equal(1, await db.CommitmentPayments.CountAsync());
        Assert.True((await db.CommitmentPayments.SingleAsync()).WasAutomatic);
        Assert.Equal(1, await db.Transactions.CountAsync(x => x.Type == TransactionType.Expense));
        var movement = await db.Transactions.SingleAsync(x => x.Type == TransactionType.Expense);
        Assert.Equal(item.Id, movement.FinancialCommitmentId);
        Assert.True(movement.WasAutomatic);
        Assert.Equal(today, movement.Date);
    }

    [Fact]
    public async Task AutomaticPaymentUpdatesBalanceReservationSummaryAndProjectionWithoutDoubleCounting()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        db.FinancialSettings.Add(new FinancialSettings(500m));
        var item = new FinancialCommitment("Aluguel", 300m, 2, 0, 300m, null, true, today, urgent: true, automaticProcessing: true);
        db.FinancialCommitments.Add(item);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        Assert.Equal(1, await service.ProcessDueAsync(today, default));
        Assert.Equal(0, await service.ProcessDueAsync(today, default));

        var balance = await new FinancialBalanceService(db).GetAsync(default);
        Assert.Equal(200m, balance.SaldoReal);
        Assert.Equal(0m, balance.TotalReservado);
        Assert.Equal(200m, balance.SaldoNaoAlocado);
        Assert.Equal(1, await db.Transactions.CountAsync(x => x.FinancialCommitmentId == item.Id));

        var saved = await db.FinancialCommitments.SingleAsync();
        Assert.Equal(1, saved.PaidInstallments);
        Assert.Equal(300m, saved.OverallRemainingAmount);
        Assert.True(saved.RequiresAttention);

        var summary = await new FinancialSummaryService(db).GetMonthlyAsync(new DateOnly(today.Year, today.Month, 1), default);
        var detail = Assert.Single(summary.Commitments);
        Assert.True(detail.IsPaid);
        Assert.Equal(300m, detail.DueAmount);
        Assert.Equal(300m, detail.AllocatedAmount);

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(2, default);
        Assert.DoesNotContain(projection.Months.SelectMany(x => x.Expenses), x => x.Id == $"{item.Id}:1");
        Assert.Contains(projection.Months.SelectMany(x => x.Expenses), x => x.Id == $"{item.Id}:2");
    }

    [Fact]
    public async Task AutomaticPaymentDoesNotPayPartiallyCoveredInstallment()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        var item = new FinancialCommitment("Parcial", 300m, 1, 0, 200m, null, true, today, automaticProcessing: true);
        db.FinancialCommitments.Add(item);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        Assert.Equal(0, (await db.FinancialCommitments.SingleAsync()).PaidInstallments);
        Assert.Empty(await db.Transactions.ToListAsync());
        Assert.Contains("faltam", (await db.FinancialCommitments.SingleAsync()).AutomaticProcessingWarning);
    }

    [Fact]
    public async Task AutomaticCommitmentWithoutCoverageRemainsPendingWithWarning()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        db.FinancialCommitments.Add(new FinancialCommitment("Sem saldo", 75m, 1, 0, 0m, null, true, today, automaticProcessing: true)); await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        var saved = await db.FinancialCommitments.SingleAsync();
        Assert.Equal(0, saved.PaidInstallments);
        Assert.Contains("Pagamento automático não realizado", saved.AutomaticProcessingWarning);
    }

    [Fact]
    public async Task NonAutomaticCommitmentIsNotProcessedAndHistoryIsPreserved()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        var item = new FinancialCommitment("Manual", 50m, 1, 0, 50m, null, true, today, automaticProcessing: false);
        db.FinancialCommitments.Add(item); await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        await service.RegisterPaymentAsync(item.Id, default);
        Assert.Equal(1, (await service.GetByIdAsync(item.Id, default))!.PaidInstallments);
        Assert.Equal(1, await db.CommitmentPayments.CountAsync());
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
