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

        // Creation materializes and receives a due automatic occurrence. A later
        // processor pass remains idempotent.
        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        Assert.Equal(1, await db.Transactions.CountAsync());
        Assert.Equal(RecurringIncomeOccurrenceStatus.Received, (await db.RecurringIncomeOccurrences.SingleAsync(x => x.Status == RecurringIncomeOccurrenceStatus.Received)).Status);

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
    public async Task AutomaticPaymentUpdatesBalanceReservationSummaryWithoutDoubleCounting()
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

    [Fact]
    public async Task ReversingPaymentRestoresBalanceReservationAndPendingState()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        var item = new FinancialCommitment("Parcela", 300m, 1, 0, 300m, null, true, today);
        db.FinancialCommitments.Add(item);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        await service.RegisterPaymentAsync(item.Id, default);
        Assert.Equal(700m, (await new FinancialBalanceService(db).GetAsync(default)).SaldoReal);
        Assert.Equal(0m, (await new FinancialBalanceService(db).GetAsync(default)).TotalReservado);

        await service.ReverseLatestPaymentAsync(item.Id, default);
        var balance = await new FinancialBalanceService(db).GetAsync(default);
        var saved = await db.FinancialCommitments.SingleAsync();
        Assert.Equal(1000m, balance.SaldoReal);
        Assert.Equal(300m, balance.TotalReservado);
        Assert.Equal(0, saved.PaidInstallments);
        Assert.Equal(300m, saved.AllocatedAmount);
        Assert.Empty(await db.CommitmentPayments.ToListAsync());
        Assert.Empty(await db.Transactions.ToListAsync());
    }

    [Fact]
    public async Task PaymentTransactionCannotBeDeletedOrEditedDirectly()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        var item = new FinancialCommitment("Parcela", 100m, 1, 0, 100m, null, true, today);
        db.FinancialCommitments.Add(item);
        await db.SaveChangesAsync();
        var commitments = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        await commitments.RegisterPaymentAsync(item.Id, default);
        var payment = await db.CommitmentPayments.SingleAsync();
        var movement = await db.Transactions.SingleAsync();
        var transactions = new TransactionService(db);

        await Assert.ThrowsAsync<InvalidOperationException>(() => transactions.DeleteAsync(movement.Id, default));
        await Assert.ThrowsAsync<InvalidOperationException>(() => transactions.UpdateAsync(movement.Id, new TransactionRequest
        {
            Description = "Alteração indevida", Amount = 100m, Type = TransactionType.Expense, Date = today
        }, default));
        Assert.NotNull(await db.CommitmentPayments.FindAsync(payment.Id));
        Assert.Equal(1, (await db.FinancialCommitments.SingleAsync()).PaidInstallments);
    }

    [Fact]
    public async Task CommitmentWithPaymentCannotBeDeletedWithoutReversingHistory()
    {
        await using var db = CreateDb();
        var today = BusinessClock.Today();
        var item = new FinancialCommitment("Histórico", 100m, 1, 0, 100m, null, true, today);
        db.FinancialCommitments.Add(item);
        await db.SaveChangesAsync();
        var commitments = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        await commitments.RegisterPaymentAsync(item.Id, default);

        await Assert.ThrowsAsync<InvalidOperationException>(() => commitments.DeleteAsync(item.Id, default));
        Assert.NotNull(await db.FinancialCommitments.FindAsync(item.Id));
        Assert.Single(await db.Transactions.ToListAsync());
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
}
