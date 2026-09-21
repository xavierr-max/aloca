using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitmentPaymentTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CommitmentPaymentId",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinancialCommitmentId",
                table: "transactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "WasAutomatic",
                table: "transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_transactions_CommitmentPaymentId",
                table: "transactions",
                column: "CommitmentPaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_transactions_FinancialCommitmentId_Date",
                table: "transactions",
                columns: new[] { "FinancialCommitmentId", "Date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_transactions_CommitmentPaymentId",
                table: "transactions");

            migrationBuilder.DropIndex(
                name: "IX_transactions_FinancialCommitmentId_Date",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "CommitmentPaymentId",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "FinancialCommitmentId",
                table: "transactions");

            migrationBuilder.DropColumn(
                name: "WasAutomatic",
                table: "transactions");
        }
    }
}
