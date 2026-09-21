using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountsAndTenantIsolation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_categories_Name",
                table: "categories");

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "recurring_incomes",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "recurring_income_occurrences",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "financial_settings",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "financial_commitments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "commitment_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "categories",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "accounts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Username = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    NormalizedUsername = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    PasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    IsLocal = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SecurityStamp = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    SessionVersion = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_accounts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "devices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_devices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "device_accounts",
                columns: table => new
                {
                    DeviceId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastUsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_accounts", x => new { x.DeviceId, x.AccountId });
                    table.ForeignKey(
                        name: "FK_device_accounts_accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_device_accounts_devices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "devices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            var migratedAccountId = new Guid("f31c3a8c-6cc4-4d46-bd9b-2f1c71d3f401");
            migrationBuilder.Sql($"""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "categories" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "transactions" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "financial_commitments" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "financial_settings" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "recurring_incomes" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "recurring_income_occurrences" LIMIT 1)
                       OR EXISTS (SELECT 1 FROM "commitment_payments" LIMIT 1) THEN
                        INSERT INTO "accounts" ("Id", "DisplayName", "Username", "NormalizedUsername", "PasswordHash", "IsLocal", "CreatedAt", "UpdatedAt", "SecurityStamp", "SessionVersion")
                        VALUES ('{migratedAccountId}', 'Minha conta', NULL, NULL, NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'migration-{migratedAccountId:N}', 1)
                        ON CONFLICT ("Id") DO NOTHING;
                    END IF;
                END $$;
                """);

            foreach (var table in new[] { "categories", "transactions", "financial_commitments", "financial_settings", "commitment_payments", "recurring_incomes", "recurring_income_occurrences" })
                migrationBuilder.Sql($"UPDATE \"{table}\" SET \"UserId\" = '{migratedAccountId}' WHERE \"UserId\" IS NULL;");

            foreach (var table in new[] { "categories", "transactions", "financial_commitments", "financial_settings", "commitment_payments", "recurring_incomes", "recurring_income_occurrences" })
                migrationBuilder.AlterColumn<Guid>(name: "UserId", table: table, type: "uuid", nullable: false, oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_transactions_UserId",
                table: "transactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_incomes_UserId",
                table: "recurring_incomes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_recurring_income_occurrences_UserId",
                table: "recurring_income_occurrences",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_financial_settings_UserId",
                table: "financial_settings",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitments_UserId",
                table: "financial_commitments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_commitment_payments_UserId",
                table: "commitment_payments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_categories_UserId_Name",
                table: "categories",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_accounts_NormalizedUsername",
                table: "accounts",
                column: "NormalizedUsername",
                unique: true,
                filter: "\"NormalizedUsername\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_device_accounts_AccountId",
                table: "device_accounts",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_devices_TokenHash",
                table: "devices",
                column: "TokenHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_categories_accounts_UserId",
                table: "categories",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_commitment_payments_accounts_UserId",
                table: "commitment_payments",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_financial_commitments_accounts_UserId",
                table: "financial_commitments",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_financial_settings_accounts_UserId",
                table: "financial_settings",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_recurring_income_occurrences_accounts_UserId",
                table: "recurring_income_occurrences",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_recurring_incomes_accounts_UserId",
                table: "recurring_incomes",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_transactions_accounts_UserId",
                table: "transactions",
                column: "UserId",
                principalTable: "accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_categories_accounts_UserId",
                table: "categories");

            migrationBuilder.DropForeignKey(
                name: "FK_commitment_payments_accounts_UserId",
                table: "commitment_payments");

            migrationBuilder.DropForeignKey(
                name: "FK_financial_commitments_accounts_UserId",
                table: "financial_commitments");

            migrationBuilder.DropForeignKey(
                name: "FK_financial_settings_accounts_UserId",
                table: "financial_settings");

            migrationBuilder.DropForeignKey(
                name: "FK_recurring_income_occurrences_accounts_UserId",
                table: "recurring_income_occurrences");

            migrationBuilder.DropForeignKey(
                name: "FK_recurring_incomes_accounts_UserId",
                table: "recurring_incomes");

            migrationBuilder.DropForeignKey(
                name: "FK_transactions_accounts_UserId",
                table: "transactions");

            migrationBuilder.DropTable(
                name: "device_accounts");

            migrationBuilder.DropTable(
                name: "accounts");

            migrationBuilder.DropTable(
                name: "devices");

            migrationBuilder.DropIndex(
                name: "IX_transactions_UserId",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "IX_recurring_incomes_UserId",
                table: "recurring_incomes");

            migrationBuilder.DropIndex(
                name: "IX_recurring_income_occurrences_UserId",
                table: "recurring_income_occurrences");

            migrationBuilder.DropIndex(
                name: "IX_financial_settings_UserId",
                table: "financial_settings");

            migrationBuilder.DropIndex(
                name: "IX_financial_commitments_UserId",
                table: "financial_commitments");

            migrationBuilder.DropIndex(
                name: "IX_commitment_payments_UserId",
                table: "commitment_payments");

            migrationBuilder.DropIndex(
                name: "IX_categories_UserId_Name",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "recurring_incomes");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "recurring_income_occurrences");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "financial_settings");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "financial_commitments");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "commitment_payments");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "categories");

            migrationBuilder.CreateIndex(
                name: "IX_categories_Name",
                table: "categories",
                column: "Name",
                unique: true);
        }
    }
}
