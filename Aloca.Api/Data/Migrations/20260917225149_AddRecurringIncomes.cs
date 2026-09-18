using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringIncomes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE transactions
                    ADD COLUMN IF NOT EXISTS "RecurringIncomeOccurrenceId" uuid;

                CREATE TABLE IF NOT EXISTS recurring_incomes (
                    "Id" uuid NOT NULL,
                    "Description" character varying(250) NOT NULL,
                    "Amount" numeric(18,2) NOT NULL,
                    "CategoryId" uuid NOT NULL,
                    "Frequency" character varying(20) NOT NULL,
                    "StartDate" date NOT NULL,
                    "EndDate" date,
                    "DayOfMonth" integer,
                    "IsActive" boolean NOT NULL DEFAULT true,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                    "UpdatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_recurring_incomes" PRIMARY KEY ("Id"),
                    CONSTRAINT ck_recurring_incomes_amount_positive CHECK ("Amount" > 0),
                    CONSTRAINT "FK_recurring_incomes_categories_CategoryId"
                        FOREIGN KEY ("CategoryId") REFERENCES categories ("Id") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS recurring_income_occurrences (
                    "Id" uuid NOT NULL,
                    "RecurringIncomeId" uuid NOT NULL,
                    "ScheduledDate" date NOT NULL,
                    "Amount" numeric(18,2) NOT NULL,
                    "Status" character varying(20) NOT NULL,
                    "TransactionId" uuid,
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                    CONSTRAINT "PK_recurring_income_occurrences" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_recurring_income_occurrences_recurring_incomes_RecurringIncomeId"
                        FOREIGN KEY ("RecurringIncomeId") REFERENCES recurring_incomes ("Id") ON DELETE CASCADE,
                    CONSTRAINT "FK_recurring_income_occurrences_transactions_TransactionId"
                        FOREIGN KEY ("TransactionId") REFERENCES transactions ("Id") ON DELETE SET NULL
                );

                ALTER TABLE recurring_incomes
                    ADD COLUMN IF NOT EXISTS "DayOfMonth" integer,
                    ADD COLUMN IF NOT EXISTS "IsActive" boolean NOT NULL DEFAULT true,
                    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                    ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamp with time zone NOT NULL DEFAULT now();

                ALTER TABLE recurring_income_occurrences
                    ADD COLUMN IF NOT EXISTS "ScheduledDate" date,
                    ADD COLUMN IF NOT EXISTS "CreatedAt" timestamp with time zone NOT NULL DEFAULT now();

                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'recurring_incomes' AND column_name = 'PreferredDay'
                    ) THEN
                        UPDATE recurring_incomes
                        SET "DayOfMonth" = "PreferredDay"
                        WHERE "DayOfMonth" IS NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'recurring_income_occurrences' AND column_name = 'Date'
                    ) THEN
                        UPDATE recurring_income_occurrences
                        SET "ScheduledDate" = "Date"
                        WHERE "ScheduledDate" IS NULL;
                    END IF;

                    ALTER TABLE recurring_income_occurrences
                        ALTER COLUMN "ScheduledDate" SET NOT NULL;
                END $$;

                CREATE UNIQUE INDEX IF NOT EXISTS "IX_transactions_RecurringIncomeOccurrenceId"
                    ON transactions ("RecurringIncomeOccurrenceId");
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_recurring_income_occurrences_RecurringIncomeId_ScheduledDate"
                    ON recurring_income_occurrences ("RecurringIncomeId", "ScheduledDate");
                CREATE INDEX IF NOT EXISTS "IX_recurring_income_occurrences_TransactionId"
                    ON recurring_income_occurrences ("TransactionId");
                CREATE INDEX IF NOT EXISTS "IX_recurring_incomes_CategoryId"
                    ON recurring_incomes ("CategoryId");
                CREATE INDEX IF NOT EXISTS "IX_recurring_incomes_IsActive_StartDate"
                    ON recurring_incomes ("IsActive", "StartDate");
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "recurring_income_occurrences");

            migrationBuilder.DropTable(
                name: "recurring_incomes");

            migrationBuilder.DropIndex(
                name: "IX_transactions_RecurringIncomeOccurrenceId",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "RecurringIncomeOccurrenceId",
                table: "transactions");
        }
    }
}
