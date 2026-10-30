using System.Diagnostics;
using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit.Abstractions;

namespace Aloca.Api.Tests;

public sealed class PostgresPerformanceBenchmarkTests
{
    private readonly ITestOutputHelper output;

    public PostgresPerformanceBenchmarkTests(ITestOutputHelper output) => this.output = output;

    [Fact]
    public async Task MeasuresRepresentativeCommitmentQueries()
    {
        var connection = Environment.GetEnvironmentVariable("ALOCA_BENCHMARK_POSTGRES_CONNECTION");
        if (string.IsNullOrWhiteSpace(connection))
            throw new InvalidOperationException("Set ALOCA_BENCHMARK_POSTGRES_CONNECTION to run the opt-in PostgreSQL benchmark.");

        var accessor = new CurrentUserAccessor();
        var options = new DbContextOptionsBuilder<AlocaDbContext>().UseNpgsql(connection).Options;
        await using var db = new AlocaDbContext(options, accessor);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        var account = new Account("Benchmark", isLocal: true);
        db.Accounts.Add(account);
        accessor.Set(account.Id);
        db.FinancialSettings.Add(new FinancialSettings(100_000m));

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        for (var index = 0; index < 500; index++)
        {
            var month = today.AddMonths(index % 12);
            db.FinancialCommitments.Add(new FinancialCommitment($"Benchmark {index}", 25m, 1, 0, 1 + index % 5, month));
            db.Transactions.Add(new Transaction($"Transaction {index}", 25m, TransactionType.Expense, month, null));
        }
        await db.SaveChangesAsync();

        var balance = new FinancialBalanceService(db);
        var commitments = new FinancialCommitmentService(db, balance);
        var forecast = new FinancialForecastService(
            new ForecastEventNormalizer(db),
            new ForecastCalculator(),
            balance,
            new SystemBusinessClock(new ConfigurationBuilder().Build()));

        var listWatch = Stopwatch.StartNew();
        var listed = await commitments.GetAllAsync(false, default);
        listWatch.Stop();

        var forecastWatch = Stopwatch.StartNew();
        var projected = await forecast.GetAsync(new DateOnly(today.Year, today.Month, 1), 12, default);
        forecastWatch.Stop();

        Assert.Equal(500, listed.Count);
        Assert.Equal(12, projected.Months.Count);
        output.WriteLine($"benchmark commitment_list_ms={listWatch.Elapsed.TotalMilliseconds:F1} forecast_ms={forecastWatch.Elapsed.TotalMilliseconds:F1}");
    }
}
