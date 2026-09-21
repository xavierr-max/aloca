using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Aloca.Api.Tests;

[Collection("PostgreSQL integration")]
public sealed class PostgresIntegrationTests
{
    private static string? ConnectionString => Environment.GetEnvironmentVariable("ALOCA_TEST_POSTGRES_CONNECTION");

    private static async Task<AlocaDbContext> CreateDatabaseAsync()
    {
        var options = new DbContextOptionsBuilder<AlocaDbContext>().UseNpgsql(ConnectionString!).Options;
        var db = new AlocaDbContext(options);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
        return db;
    }

    [Fact]
    public async Task Empty_database_applies_all_migrations_and_preserves_postgres_types()
    {
        if (ConnectionString is null) return;
        await using var db = await CreateDatabaseAsync();
        Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync());
        var columns = await db.Database.SqlQueryRaw<string>("""
            SELECT format('%s|%s|%s|%s', column_name, data_type, numeric_precision, numeric_scale)::text AS "Value"
            FROM information_schema.columns
            WHERE table_name = 'transactions' AND column_name IN ('Amount', 'Date')
            """).ToListAsync();
        Assert.Contains("Amount|numeric|18|2", columns);
        Assert.Contains("Date|date||", columns);
    }

    [Fact]
    public async Task Constraints_and_transactions_are_enforced_by_postgres()
    {
        if (ConnectionString is null) return;
        await using var db = await CreateDatabaseAsync();
        var uniqueIndexes = await db.Database.SqlQueryRaw<long>("""
            SELECT COUNT(*) AS "Value" FROM pg_indexes
            WHERE tablename = 'commitment_payments' AND indexdef ILIKE '%UNIQUE%'
            """).SingleAsync();
        Assert.True(uniqueIndexes > 0);

        await using var connection = (NpgsqlConnection)db.Database.GetDbConnection();
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using (var command = new NpgsqlCommand("CREATE TEMP TABLE transaction_probe (value integer NOT NULL); INSERT INTO transaction_probe VALUES (1);", connection, transaction))
            await command.ExecuteNonQueryAsync();
        await transaction.RollbackAsync();
        await using var check = new NpgsqlCommand("SELECT to_regclass('pg_temp.transaction_probe') IS NULL", connection);
        Assert.True((bool)(await check.ExecuteScalarAsync())!);
    }

    [Fact]
    public async Task Foreign_keys_and_cascades_are_present_for_tenant_data()
    {
        if (ConnectionString is null) return;
        await using var db = await CreateDatabaseAsync();
        var foreignKeys = await db.Database.SqlQueryRaw<long>("""
            SELECT COUNT(*) AS "Value" FROM information_schema.table_constraints
            WHERE constraint_type = 'FOREIGN KEY'
              AND table_name IN ('transactions', 'financial_commitments', 'recurring_income_occurrences')
            """).SingleAsync();
        Assert.True(foreignKeys >= 3);
        var cascades = await db.Database.SqlQueryRaw<long>("""
            SELECT COUNT(*) AS "Value" FROM information_schema.referential_constraints
            WHERE delete_rule = 'CASCADE'
            """).SingleAsync();
        Assert.True(cascades >= 3);
    }
}
