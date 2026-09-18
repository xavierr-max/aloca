using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialAllocationTests
{
    [Fact]
    public void FinancialCalculationsMatchTheCanonicalScenario()
    {
        Assert.Equal(490.28m, FinancialCalculations.SaldoReal(490.28m, 0m));
        Assert.Equal(198.90m, FinancialCalculations.TotalReservado(new[] { 198.90m }));
        Assert.Equal(291.38m, FinancialCalculations.SaldoNaoAlocado(490.28m, 198.90m));
        Assert.Equal(0m, FinancialCalculations.DeficitCobertura(198.90m, 198.90m));
        Assert.Equal(291.38m, FinancialCalculations.SaldoLivre(291.38m, 0m));
    }

    [Fact]
    public async Task DistributesByPriorityAndDoesNotExceedBalance()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 1000m, TransactionType.Income);
        db.FinancialCommitments.AddRange(
            Commitment("Academia", 120m, 1, true),
            Commitment("Notebook", 600m, 2, true),
            Commitment("Curso", 300m, 3, true));
        await db.SaveChangesAsync();

        var result = await Allocation(db).DistributeAsync(default);

        Assert.Equal(1000m, result.NewlyAllocated);
        Assert.Equal(new[] { 120m, 600m, 280m }, result.Allocations.Select(x => x.Amount));
        Assert.Equal(0m, result.FreeBalanceAfter);
    }

    [Fact]
    public async Task PreviewUsesSamePlanWithoutPersisting()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 1000m, TransactionType.Income);
        db.FinancialCommitments.Add(Commitment("A", 500m, 1, true));
        await db.SaveChangesAsync();

        var preview = await Allocation(db).PreviewAsync(default);

        Assert.Equal(500m, preview.WouldAllocate);
        Assert.Equal(0m, await db.FinancialCommitments.SumAsync(x => x.AllocatedAmount));
    }

    [Fact]
    public async Task SecondDistributionIsIdempotentAndNewIncomeUsesOnlyNewBalance()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 1000m, TransactionType.Income);
        var commitment = Commitment("A", 1500m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = Allocation(db);

        Assert.Equal(1000m, (await service.DistributeAsync(default)).NewlyAllocated);
        Assert.Equal(0m, (await service.DistributeAsync(default)).NewlyAllocated);
        await SeedTransaction(db, 300m, TransactionType.Income);

        Assert.Equal(300m, (await service.DistributeAsync(default)).NewlyAllocated);
        Assert.Equal(1300m, await db.FinancialCommitments.SumAsync(x => x.AllocatedAmount));
    }

    [Fact]
    public async Task SummaryReportsDeficitWithoutRemovingAllocation()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 1000m, TransactionType.Income);
        db.FinancialCommitments.Add(Commitment("A", 1000m, 1, true, 1000m));
        await db.SaveChangesAsync();
        await SeedTransaction(db, 200m, TransactionType.Expense);

        var summary = await new FinancialSummaryService(new FinancialBalanceService(db)).GetAsync(default);

        Assert.Equal(800m, summary.Balance);
        Assert.Equal(1000m, summary.AllocatedAmount);
        Assert.Equal(0m, summary.FreeBalance);
        Assert.Equal(0m, summary.AllocationDeficit);
    }

    [Fact]
    public async Task SummaryUsesExistingReservationsForDashboardIndicators()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 490.28m, TransactionType.Income);
        db.FinancialCommitments.Add(Commitment("Reserva manual", 198.90m, 1, false, 198.90m));
        await db.SaveChangesAsync();

        var summary = await new FinancialSummaryService(new FinancialBalanceService(db)).GetAsync(default);

        Assert.Equal(490.28m, summary.SaldoReal);
        Assert.Equal(198.90m, summary.TotalReservado);
        Assert.Equal(291.38m, summary.SaldoNaoAlocado);
        Assert.Equal(0m, summary.DeficitCobertura);
        Assert.Equal(291.38m, summary.SaldoLivre);
    }

    [Fact]
    public async Task PaymentConsumesReservePersistsHistoryAndReducesRealBalance()
    {
        await using var db = CreateDb();
        await new FinancialSettingsService(db).UpdateAsync(490m, default);
        var commitment = new FinancialCommitment("Subscription", 63.66m, 3, 0, 190.98m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        await service.RegisterPaymentAsync(commitment.Id, default);

        var summary = await new FinancialSummaryService(new FinancialBalanceService(db)).GetAsync(default);
        Assert.Equal(426.34m, summary.Balance);
        Assert.Equal(127.32m, (await service.GetByIdAsync(commitment.Id, default))!.AllocatedAmount);
        Assert.Equal(1, (await service.GetByIdAsync(commitment.Id, default))!.PaidInstallments);
        Assert.Equal(1, await db.CommitmentPayments.CountAsync());
    }

    [Fact]
    public async Task PayingFromReservationKeepsUnallocatedBalanceUnchanged()
    {
        await using var db = CreateDb();
        await new FinancialSettingsService(db).UpdateAsync(490.28m, default);
        var commitment = new FinancialCommitment("Compra", 66.30m, 3, 0, 198.90m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        var before = await new FinancialSummaryService(db).GetAsync(default);
        await service.RegisterPaymentAsync(commitment.Id, default);
        var after = await new FinancialSummaryService(db).GetAsync(default);

        Assert.Equal(490.28m, before.SaldoReal);
        Assert.Equal(198.90m, before.TotalReservado);
        Assert.Equal(291.38m, before.SaldoNaoAlocado);
        Assert.Equal(423.98m, after.SaldoReal);
        Assert.Equal(132.60m, after.TotalReservado);
        Assert.Equal(291.38m, after.SaldoNaoAlocado);
        Assert.Equal(132.60m, (await service.GetByIdAsync(commitment.Id, default))!.RemainingAmount);
        Assert.Equal(1, (await service.GetByIdAsync(commitment.Id, default))!.PaidInstallments);
    }

    [Fact]
    public async Task ReversingPaymentRestoresBalanceReservationAndInstallment()
    {
        await using var db = CreateDb();
        await new FinancialSettingsService(db).UpdateAsync(490.28m, default);
        var commitment = new FinancialCommitment("Compra", 66.30m, 3, 0, 198.90m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));

        await service.RegisterPaymentAsync(commitment.Id, default);
        await service.ReverseLatestPaymentAsync(commitment.Id, default);
        var summary = await new FinancialSummaryService(db).GetAsync(default);
        var restored = await service.GetByIdAsync(commitment.Id, default);

        Assert.Equal(490.28m, summary.SaldoReal);
        Assert.Equal(198.90m, summary.TotalReservado);
        Assert.Equal(291.38m, summary.SaldoNaoAlocado);
        Assert.Equal(0, restored!.PaidInstallments);
        Assert.Equal(198.90m, restored.AllocatedAmount);
        Assert.Equal(0, await db.CommitmentPayments.CountAsync());
    }

    [Fact]
    public async Task CoverageDeficitIsRemainingUncoveredAmount()
    {
        await using var db = CreateDb();
        db.FinancialCommitments.Add(new FinancialCommitment("Course", 200m, 3, 0, 490m, 1, true));
        await db.SaveChangesAsync();

        var summary = await new FinancialSummaryService(new FinancialBalanceService(db)).GetAsync(default);

        Assert.Equal(110m, summary.AllocationDeficit);
    }

    [Fact]
    public async Task IgnoresDisabledCompletedAndManualExcessCommitments()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 1000m, TransactionType.Income);
        db.FinancialCommitments.AddRange(
            Commitment("Disabled", 100m, 1, false),
            Commitment("Completed", 100m, 1, true, paidInstallments: 1),
            Commitment("Excess", 100m, 1, true, allocatedAmount: 150m),
            Commitment("Eligible", 200m, 1, true));
        await db.SaveChangesAsync();

        var result = await Allocation(db).DistributeAsync(default);

        var change = Assert.Single(result.Allocations);
        Assert.Equal("Eligible", change.Name);
        Assert.Equal(200m, change.Amount);
    }

    [Fact]
    public async Task EqualPrioritiesAreOrderedByName()
    {
        await using var db = CreateDb();
        await SeedTransaction(db, 100m, TransactionType.Income);
        db.FinancialCommitments.AddRange(Commitment("B", 100m, 1, true), Commitment("A", 100m, 1, true));
        await db.SaveChangesAsync();

        var result = await Allocation(db).DistributeAsync(default);

        Assert.Equal("A", Assert.Single(result.Allocations).Name);
    }

    [Fact]
    public async Task InitialBalanceContributesToSummaryWithoutCreatingTransaction()
    {
        await using var db = CreateDb();
        var settings = new FinancialSettingsService(db);
        await settings.UpdateAsync(1500m, default);

        var summary = await new FinancialSummaryService(new FinancialBalanceService(db)).GetAsync(default);

        Assert.Equal(1500m, summary.InitialBalance);
        Assert.Equal(1500m, summary.Balance);
        Assert.Equal(0m, summary.TotalIncome);
        Assert.Equal(0, await db.Transactions.CountAsync());
    }

    private static FinancialAllocationService Allocation(AlocaDbContext db) => new(db, new FinancialBalanceService(db));

    private static FinancialCommitment Commitment(string name, decimal amount, int priority, bool enabled, decimal allocatedAmount = 0m, int paidInstallments = 0) =>
        new(name, amount, 1, paidInstallments, allocatedAmount, priority, enabled);

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static async Task SeedTransaction(AlocaDbContext db, decimal amount, TransactionType type)
    {
        var category = new Category("Test");
        db.Categories.Add(category);
        db.Transactions.Add(new Transaction("Test", amount, type, DateOnly.FromDateTime(DateTime.UtcNow), category.Id));
        await db.SaveChangesAsync();
    }
}
