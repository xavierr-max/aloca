using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class AutomaticProcessingTests
{
    private static AlocaDbContext Db() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    [Fact]
    public async Task AutomaticPaymentBlocksWhenBalanceIsInsufficient()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(100m));
        db.FinancialCommitments.Add(new FinancialCommitment("Automática", 150m, 1, 0, null, DateOnly.FromDateTime(DateTime.UtcNow), automaticProcessing: true));
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        Assert.Equal(0, await service.ProcessDueAsync(DateOnly.FromDateTime(DateTime.UtcNow), default));
        Assert.Empty(await db.CommitmentPayments.ToListAsync());
        Assert.Equal(100m, (await new FinancialBalanceService(db).GetAsync(default)).SaldoReal);
    }

    [Fact]
    public async Task ReversalIsAuditableIdempotentAndRestoresPendingState()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(500m));
        var commitment = new FinancialCommitment("Conta", 100m, 1, 0, null, DateOnly.FromDateTime(DateTime.UtcNow));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        await service.RegisterPaymentAsync(commitment.Id, default);
        await service.ReverseLatestPaymentAsync(commitment.Id, default);
        await service.ReverseLatestPaymentAsync(commitment.Id, default);
        Assert.Equal(1, await db.Transactions.CountAsync(x => x.Type == TransactionType.Income && x.ReversesTransactionId.HasValue));
        Assert.Equal(1, await db.CommitmentPayments.CountAsync(x => x.ReversedAt.HasValue));
        Assert.Equal(500m, (await new FinancialBalanceService(db).GetAsync(default)).SaldoReal);
        Assert.Equal(0, (await db.FinancialCommitments.SingleAsync()).PaidInstallments);

        var reversal = await db.Transactions.SingleAsync(x => x.ReversesTransactionId.HasValue);
        var transactions = new TransactionService(db);
        await Assert.ThrowsAsync<InvalidOperationException>(() => transactions.DeleteAsync(reversal.Id, default));
        await Assert.ThrowsAsync<InvalidOperationException>(() => transactions.UpdateAsync(reversal.Id,
            new Aloca.Api.DTOs.TransactionRequest { Description = "alteração", Amount = 100m, Type = TransactionType.Income, Date = DateOnly.FromDateTime(DateTime.UtcNow) }, default));
    }

    [Fact]
    public async Task ReversalSkipsAlreadyReversedPaymentAndFindsPreviousActivePayment()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(500m));
        var commitment = new FinancialCommitment("Parcelado", 100m, 2, 0, null, DateOnly.FromDateTime(DateTime.UtcNow));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        await service.RegisterPaymentAsync(commitment.Id, default);
        await service.RegisterPaymentAsync(commitment.Id, default);
        await service.ReverseLatestPaymentAsync(commitment.Id, default);
        await service.ReverseLatestPaymentAsync(commitment.Id, default);

        Assert.Equal(2, await db.CommitmentPayments.CountAsync(x => x.ReversedAt.HasValue));
        Assert.Equal(2, await db.Transactions.CountAsync(x => x.ReversesTransactionId.HasValue));
        Assert.Equal(0, await db.FinancialCommitments.Where(x => x.Id == commitment.Id).Select(x => x.PaidInstallments).SingleAsync());
    }

    [Fact]
    public async Task ProcessesSeveralDueRecurringIncomesWithoutDuplicatingTransactions()
    {
        await using var db = Db();
        var category = new Category("Receitas");
        db.Categories.Add(category);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        for (var index = 0; index < 20; index++)
        {
            db.RecurringIncomes.Add(new RecurringIncome(
                $"Receita {index}", 100m + index, category.Id,
                RecurringIncomeFrequency.Monthly, today, today,
                today.Day, automaticProcessing: true));
        }

        await db.SaveChangesAsync();
        var service = new RecurringIncomeService(db);

        Assert.Equal(20, await service.ProcessDueAsync(today, default));
        Assert.Equal(20, await db.Transactions.CountAsync(x => x.Type == TransactionType.Income));
        Assert.Equal(20, await db.RecurringIncomeOccurrences.CountAsync(x => x.Status == RecurringIncomeOccurrenceStatus.Received));

        Assert.Equal(0, await service.ProcessDueAsync(today, default));
        Assert.Equal(20, await db.Transactions.CountAsync(x => x.Type == TransactionType.Income));
    }
}
