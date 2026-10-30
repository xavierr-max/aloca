using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class AllocationRemovalRegressionTests
{
    private static AlocaDbContext Db()
    {
        var options = new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlocaDbContext(options);
    }

    [Fact]
    public async Task CommitmentCreationDoesNotChangeCurrentBalance()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(100m));
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        await service.CreateAsync(new Aloca.Api.DTOs.FinancialCommitmentCreateRequest("Conta", 150m, 1, null), default);
        Assert.Equal(100m, (await new FinancialBalanceService(db).GetAsync(default)).SaldoReal);
    }

    [Fact]
    public async Task ManualPaymentRequiresConfirmationForInsufficientBalance()
    {
        await using var db = Db();
        db.FinancialSettings.Add(new FinancialSettings(10m));
        var commitment = new FinancialCommitment("Conta", 25m, 1, 0, null);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        await Assert.ThrowsAsync<InsufficientBalanceConfirmationRequiredException>(() => service.RegisterPaymentAsync(commitment.Id, default));
        await service.RegisterPaymentAsync(commitment.Id, default, confirmInsufficientBalance: true);
        Assert.Equal(-15m, (await new FinancialBalanceService(db).GetAsync(default)).SaldoReal);
    }
}
