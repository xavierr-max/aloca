using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations;

[Migration("20260917230100_MakeLegacyRecurringColumnsOptional")]
[DbContext(typeof(AlocaDbContext))]
public partial class MakeLegacyRecurringColumnsOptional : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'recurring_incomes' AND column_name = 'Status'
                ) THEN
                    ALTER TABLE recurring_incomes
                        ALTER COLUMN "Status" DROP NOT NULL;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'recurring_income_occurrences' AND column_name = 'Period'
                ) THEN
                    ALTER TABLE recurring_income_occurrences
                        ALTER COLUMN "Period" DROP NOT NULL;
                END IF;

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'recurring_income_occurrences' AND column_name = 'Date'
                ) THEN
                    ALTER TABLE recurring_income_occurrences
                        ALTER COLUMN "Date" DROP NOT NULL;
                END IF;
            END $$;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE recurring_incomes
                ALTER COLUMN "Status" SET NOT NULL;
            ALTER TABLE recurring_income_occurrences
                ALTER COLUMN "Period" SET NOT NULL,
                ALTER COLUMN "Date" SET NOT NULL;
            """);
    }
}
