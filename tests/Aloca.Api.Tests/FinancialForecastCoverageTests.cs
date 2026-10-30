using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialForecastCoverageTests
{
    [Fact]
    public void CurrentBalanceFormulaDoesNotIncludeFutureCommitments()
        => Assert.Equal(800m, FinancialCalculations.CurrentBalance(1000m, 300m, 500m));

    [Fact]
    public async Task PendingCommitmentIsForecastOnly()
    {
        await using var db = CreateDb();
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.FinancialCommitments.Add(new FinancialCommitment("Futuro", 200m, 1, 0, null, new DateOnly(2030, 1, 1)));
        await db.SaveChangesAsync();
        var balance = await new FinancialBalanceService(db).GetAsync(default);
        Assert.Equal(1000m, balance.CurrentBalance);
    }

    [Fact]
    public async Task CommitmentListingHandlesOneHundredItemsWithGeneratedOccurrences()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        for (var index = 0; index < 100; index++)
            db.FinancialCommitments.Add(new FinancialCommitment($"Compromisso {index}", 25m, 1, 0, null, today));
        await db.SaveChangesAsync();

        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        var result = await service.GetAllAsync(false, default);

        Assert.Equal(100, result.Count);
        Assert.All(result, item =>
        {
            Assert.NotNull(item.Occurrences);
            Assert.Single(item.Occurrences!);
        });
    }

    private static AlocaDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
        return new AlocaDbContext(options);
    }
}
