using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancialCommitmentOccurrences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FinancialCommitmentOccurrenceId",
                table: "commitment_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "financial_commitment_occurrences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FinancialCommitmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    InstallmentNumber = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CommitmentPaymentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_financial_commitment_occurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_financial_commitment_occurrences_accounts_UserId",
                        column: x => x.UserId,
                        principalTable: "accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_financial_commitment_occurrences_commitment_payments_Commit~",
                        column: x => x.CommitmentPaymentId,
                        principalTable: "commitment_payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_financial_commitment_occurrences_financial_commitments_Fina~",
                        column: x => x.FinancialCommitmentId,
                        principalTable: "financial_commitments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_commitment_payments_FinancialCommitmentOccurrenceId",
                table: "commitment_payments",
                column: "FinancialCommitmentOccurrenceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitment_occurrences_CommitmentPaymentId",
                table: "financial_commitment_occurrences",
                column: "CommitmentPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitment_occurrences_FinancialCommitmentId_Sche~",
                table: "financial_commitment_occurrences",
                columns: new[] { "FinancialCommitmentId", "ScheduledDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_financial_commitment_occurrences_UserId",
                table: "financial_commitment_occurrences",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_commitment_payments_financial_commitment_occurrences_Financ~",
                table: "commitment_payments",
                column: "FinancialCommitmentOccurrenceId",
                principalTable: "financial_commitment_occurrences",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_commitment_payments_financial_commitment_occurrences_Financ~",
                table: "commitment_payments");

            migrationBuilder.DropTable(
                name: "financial_commitment_occurrences");

            migrationBuilder.DropIndex(
                name: "IX_commitment_payments_FinancialCommitmentOccurrenceId",
                table: "commitment_payments");

            migrationBuilder.DropColumn(
                name: "FinancialCommitmentOccurrenceId",
                table: "commitment_payments");
        }
    }
}
