using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

[Collection("PostgreSQL integration")]
public sealed class PostgresPaymentConcurrencyTests
{
    private static string? ConnectionString => Environment.GetEnvironmentVariable("ALOCA_TEST_POSTGRES_CONNECTION");

    [Fact]
    public async Task Concurrent_payments_create_one_payment_and_one_expense()
    {
        if (ConnectionString is null) return;
        var initialized = await CreateDatabaseAsync();
        await using var setup = initialized.Db;
        var accountId = initialized.AccountId;
        setup.FinancialSettings.Add(new FinancialSettings(1000m));
        var commitment = new FinancialCommitment("Conta", 100m, 1, 0, null, DateOnly.FromDateTime(DateTime.UtcNow));
        setup.FinancialCommitments.Add(commitment);
        await setup.SaveChangesAsync();
        var id = commitment.Id;

        await using var db1 = NewContext(accountId);
        await using var db2 = NewContext(accountId);
        var results = await Task.WhenAll(
            new FinancialCommitmentService(db1, new FinancialBalanceService(db1)).RegisterPaymentAsync(id, default),
            new FinancialCommitmentService(db2, new FinancialBalanceService(db2)).RegisterPaymentAsync(id, default));

        await using var verify = NewContext(accountId);
        Assert.Equal(1, await verify.CommitmentPayments.CountAsync(x => x.FinancialCommitmentId == id));
        Assert.Equal(1, await verify.Transactions.CountAsync(x => x.FinancialCommitmentId == id && x.Type == TransactionType.Expense));
        Assert.Equal(1, await verify.FinancialCommitments.Where(x => x.Id == id).Select(x => x.PaidInstallments).SingleAsync());
        Assert.Contains(results, x => x is not null);
    }

    [Fact]
    public async Task Concurrent_reversals_create_one_compensation_and_restore_pending_state()
    {
        if (ConnectionString is null) return;
        var initialized = await CreateDatabaseAsync();
        await using var setup = initialized.Db;
        var accountId = initialized.AccountId;
        setup.FinancialSettings.Add(new FinancialSettings(1000m));
        var commitment = new FinancialCommitment("Conta", 100m, 1, 0, null, DateOnly.FromDateTime(DateTime.UtcNow));
        setup.FinancialCommitments.Add(commitment);
        await setup.SaveChangesAsync();
        var id = commitment.Id;
        await new FinancialCommitmentService(setup, new FinancialBalanceService(setup)).RegisterPaymentAsync(id, default);

        await using var db1 = NewContext(accountId);
        await using var db2 = NewContext(accountId);
        await Task.WhenAll(
            new FinancialCommitmentService(db1, new FinancialBalanceService(db1)).ReverseLatestPaymentAsync(id, default),
            new FinancialCommitmentService(db2, new FinancialBalanceService(db2)).ReverseLatestPaymentAsync(id, default));

        await using var verify = NewContext(accountId);
        Assert.Equal(1, await verify.Transactions.CountAsync(x => x.FinancialCommitmentId == id && x.Type == TransactionType.Expense));
        Assert.Equal(1, await verify.Transactions.CountAsync(x => x.FinancialCommitmentId == id && x.ReversesTransactionId != null));
        Assert.Equal(0, await verify.FinancialCommitments.Where(x => x.Id == id).Select(x => x.PaidInstallments).SingleAsync());
    }

    private static async Task<(AlocaDbContext Db, Guid AccountId)> CreateDatabaseAsync()
    {
        var db = new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseNpgsql(ConnectionString!).Options);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        var account = new Account("Teste");
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        await db.DisposeAsync();
        return (NewContext(account.Id), account.Id);
    }

    private static AlocaDbContext NewContext(Guid accountId)
    {
        var accessor = new CurrentUserAccessor();
        accessor.Set(accountId);
        return new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseNpgsql(ConnectionString!).Options, accessor);
    }
}
