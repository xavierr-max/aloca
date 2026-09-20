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
