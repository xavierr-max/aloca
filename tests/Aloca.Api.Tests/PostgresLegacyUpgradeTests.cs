using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Aloca.Api.Tests;

[Collection("PostgreSQL integration")]
public sealed class PostgresLegacyUpgradeTests
{
    private static string? ConnectionString => Environment.GetEnvironmentVariable("ALOCA_TEST_POSTGRES_CONNECTION");

    [Fact]
    public async Task Populated_legacy_database_preserves_financial_data_during_allocation_removal()
    {
        if (ConnectionString is null) return;
        await using var db = NewContext();
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync("20260926190937_AddPasswordResetTokens");

        var accountId = Guid.NewGuid();
        var commitmentId = Guid.NewGuid();
        var occurrenceId = Guid.NewGuid();
        var paymentId = Guid.NewGuid();
        var paymentTransactionId = Guid.NewGuid();
        var incomeId = Guid.NewGuid();
        var expenseId = Guid.NewGuid();
        await using var connection = (NpgsqlConnection)db.Database.GetDbConnection();
        await connection.OpenAsync();
        await ExecuteAsync(connection, $"""
            INSERT INTO accounts ("Id", "DisplayName", "PasswordHash", "IsLocal", "CreatedAt", "UpdatedAt", "SecurityStamp", "SessionVersion")
            VALUES ('{accountId}', 'Legado', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'legacy-stamp', 1);
            INSERT INTO financial_settings ("Id", "UserId", "InitialBalance") VALUES (1, '{accountId}', 1000.00);
            INSERT INTO financial_commitments ("Id", "UserId", "Name", "InstallmentAmount", "TotalInstallments", "PaidInstallments", "AllocatedAmount", "Priority", "IsFullyCommitted", "CategoryId", "DueDate", "Frequency", "EndDate", "IsRecurring", "Objective", "Urgent", "AutomaticProcessing", "AutomaticProcessingWarning")
            VALUES ('{commitmentId}', '{accountId}', 'Legado', 200.00, 2, 1, 150.00, 1, TRUE, NULL, CURRENT_DATE, 3, CURRENT_DATE + INTERVAL '1 month', TRUE, 'histórico', FALSE, FALSE, NULL);
            INSERT INTO financial_commitment_occurrences ("Id", "UserId", "FinancialCommitmentId", "ScheduledDate", "InstallmentNumber", "Amount", "Status", "CommitmentPaymentId", "CreatedAt", "ProcessedAt")
            VALUES ('{occurrenceId}', '{accountId}', '{commitmentId}', CURRENT_DATE, 1, 200.00, 'Paid', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            INSERT INTO commitment_payments ("Id", "UserId", "FinancialCommitmentId", "Amount", "InstallmentNumber", "PaidAt", "WasAutomatic", "FinancialCommitmentOccurrenceId")
            VALUES ('{paymentId}', '{accountId}', '{commitmentId}', 200.00, 1, CURRENT_TIMESTAMP, FALSE, '{occurrenceId}');
            UPDATE financial_commitment_occurrences SET "CommitmentPaymentId" = '{paymentId}' WHERE "Id" = '{occurrenceId}';
            INSERT INTO transactions ("Id", "UserId", "Description", "Amount", "Type", "Date", "CategoryId", "RecurringIncomeOccurrenceId", "FinancialCommitmentId", "WasAutomatic", "CommitmentPaymentId", "IsBalanceAdjustment", "CreatedAt", "ProcessedAt")
            VALUES ('{paymentTransactionId}', '{accountId}', 'Pagamento legado', 200.00, 'Expense', CURRENT_DATE, NULL, NULL, '{commitmentId}', FALSE, '{paymentId}', FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            INSERT INTO transactions ("Id", "UserId", "Description", "Amount", "Type", "Date", "CategoryId", "RecurringIncomeOccurrenceId", "FinancialCommitmentId", "WasAutomatic", "CommitmentPaymentId", "IsBalanceAdjustment", "CreatedAt", "ProcessedAt")
            VALUES ('{incomeId}', '{accountId}', 'Receita legada', 500.00, 'Income', CURRENT_DATE, NULL, NULL, NULL, FALSE, NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            INSERT INTO transactions ("Id", "UserId", "Description", "Amount", "Type", "Date", "CategoryId", "RecurringIncomeOccurrenceId", "FinancialCommitmentId", "WasAutomatic", "CommitmentPaymentId", "IsBalanceAdjustment", "CreatedAt", "ProcessedAt")
            VALUES ('{expenseId}', '{accountId}', 'Despesa legada', 75.00, 'Expense', CURRENT_DATE, NULL, NULL, NULL, FALSE, NULL, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            """);

        const decimal expectedBalance = 1225m;
        await db.Database.MigrateAsync();

        Assert.Equal(1, await ScalarAsync<long>(connection, $"SELECT COUNT(*) FROM financial_commitments WHERE \"Id\" = '{commitmentId}' AND \"PaidInstallments\" = 1"));
        Assert.Equal(1, await ScalarAsync<long>(connection, $"SELECT COUNT(*) FROM commitment_payments WHERE \"Id\" = '{paymentId}'"));
        Assert.Equal(3, await ScalarAsync<long>(connection, $"SELECT COUNT(*) FROM transactions WHERE \"Id\" IN ('{paymentTransactionId}', '{incomeId}', '{expenseId}')"));
        Assert.Equal(1, await ScalarAsync<long>(connection, $"SELECT COUNT(*) FROM financial_commitment_allocation_archive WHERE \"FinancialCommitmentId\" = '{commitmentId}' AND \"HistoricalAllocatedAmount\" = 150.00 AND \"HistoricalFullyCommitted\" = TRUE"));
        Assert.Equal(expectedBalance, await ScalarAsync<decimal>(connection, "SELECT s.\"InitialBalance\" + COALESCE(SUM(CASE WHEN t.\"Type\" = 'Income' THEN t.\"Amount\" ELSE -t.\"Amount\" END), 0) FROM financial_settings s LEFT JOIN transactions t ON t.\"UserId\" = s.\"UserId\" WHERE s.\"Id\" = 1 GROUP BY s.\"InitialBalance\""));
        Assert.Equal(0, await ScalarAsync<long>(connection, "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'financial_commitments' AND column_name IN ('AllocatedAmount', 'IsFullyCommitted')"));

        var beforeRepeat = await ScalarAsync<long>(connection, "SELECT COUNT(*) FROM financial_commitment_allocation_archive");
        await db.Database.MigrateAsync();
        Assert.Equal(beforeRepeat, await ScalarAsync<long>(connection, "SELECT COUNT(*) FROM financial_commitment_allocation_archive"));
    }

    private static AlocaDbContext NewContext() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseNpgsql(ConnectionString!).Options);
    private static async Task ExecuteAsync(NpgsqlConnection connection, string sql)
    { await using var command = new NpgsqlCommand(sql, connection); await command.ExecuteNonQueryAsync(); }
    private static async Task<T> ScalarAsync<T>(NpgsqlConnection connection, string sql)
    { await using var command = new NpgsqlCommand(sql, connection); return (T)(await command.ExecuteScalarAsync())!; }
}
