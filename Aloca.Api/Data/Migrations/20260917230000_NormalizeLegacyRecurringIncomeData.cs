using Microsoft.EntityFrameworkCore.Migrations;
using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Aloca.Api.Data.Migrations;

[Migration("20260917230000_NormalizeLegacyRecurringIncomeData")]
[DbContext(typeof(AlocaDbContext))]
public partial class NormalizeLegacyRecurringIncomeData : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE recurring_income_occurrences
            SET "Status" = CASE "Status"
                WHEN 'Pending' THEN 'Planned'
                WHEN 'Confirmed' THEN 'Received'
                WHEN 'Ignored' THEN 'Cancelled'
                ELSE "Status"
            END
            WHERE "Status" IN ('Pending', 'Confirmed', 'Ignored');
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE recurring_income_occurrences
            SET "Status" = CASE "Status"
                WHEN 'Planned' THEN 'Pending'
                WHEN 'Received' THEN 'Confirmed'
                WHEN 'Cancelled' THEN 'Ignored'
                ELSE "Status"
            END
            WHERE "Status" IN ('Planned', 'Received', 'Cancelled');
            """);
    }
}
