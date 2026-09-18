using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ProtectRecurringIncomeOccurrenceReceipt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_transactions_RecurringIncomeOccurrenceId",
                table: "transactions");

            migrationBuilder.CreateIndex(
                name: "IX_transactions_RecurringIncomeOccurrenceId",
                table: "transactions",
                column: "RecurringIncomeOccurrenceId",
                unique: true,
                filter: "\"RecurringIncomeOccurrenceId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_transactions_RecurringIncomeOccurrenceId",
                table: "transactions");

            migrationBuilder.CreateIndex(
                name: "IX_transactions_RecurringIncomeOccurrenceId",
                table: "transactions",
                column: "RecurringIncomeOccurrenceId",
                unique: true);
        }
    }
}
