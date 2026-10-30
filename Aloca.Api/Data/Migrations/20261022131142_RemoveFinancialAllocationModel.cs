using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveFinancialAllocationModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "financial_commitment_allocation_archive",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FinancialCommitmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    HistoricalAllocatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    HistoricalFullyCommitted = table.Column<bool>(type: "boolean", nullable: false),
                    ArchivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_financial_commitment_allocation_archive", x => x.Id);
                    table.ForeignKey(
                        name: "FK_financial_commitment_allocation_archive_accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitment_allocation_archive_UserId_FinancialCom~",
                table: "financial_commitment_allocation_archive",
                columns: new[] { "UserId", "FinancialCommitmentId" },
                unique: true);

            // Preserve the historical intent before removing the active
            // allocation columns. This archive is not used in balance or
            // forecasting and is intentionally immutable.
            migrationBuilder.Sql("""
                INSERT INTO financial_commitment_allocation_archive
                    ("Id", "UserId", "FinancialCommitmentId", "HistoricalAllocatedAmount", "HistoricalFullyCommitted", "ArchivedAt")
                SELECT md5(fc."UserId"::text || fc."Id"::text)::uuid,
                       fc."UserId", fc."Id", fc."AllocatedAmount", fc."IsFullyCommitted", CURRENT_TIMESTAMP
                FROM financial_commitments fc;
                """);

            migrationBuilder.DropIndex(
                name: "IX_financial_commitments_IsFullyCommitted_Priority",
                table: "financial_commitments");
            migrationBuilder.DropCheckConstraint(
                name: "ck_financial_commitments_allocated_amount_non_negative",
                table: "financial_commitments");
            migrationBuilder.DropColumn(name: "AllocatedAmount", table: "financial_commitments");
            migrationBuilder.DropColumn(name: "IsFullyCommitted", table: "financial_commitments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AllocatedAmount",
                table: "financial_commitments",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "IsFullyCommitted",
                table: "financial_commitments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("""
                UPDATE financial_commitments fc
                SET "AllocatedAmount" = archive."HistoricalAllocatedAmount",
                    "IsFullyCommitted" = archive."HistoricalFullyCommitted"
                FROM financial_commitment_allocation_archive archive
                WHERE archive."FinancialCommitmentId" = fc."Id"
                  AND archive."UserId" = fc."UserId";
                """);

            migrationBuilder.AddCheckConstraint(
                name: "ck_financial_commitments_allocated_amount_non_negative",
                table: "financial_commitments",
                sql: "\"AllocatedAmount\" >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitments_IsFullyCommitted_Priority",
                table: "financial_commitments",
                columns: new[] { "IsFullyCommitted", "Priority" });

            migrationBuilder.DropTable(
                name: "financial_commitment_allocation_archive");
        }
    }
}
