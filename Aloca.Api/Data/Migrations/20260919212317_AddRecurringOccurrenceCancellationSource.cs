using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringOccurrenceCancellationSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancellationSource",
                table: "recurring_income_occurrences",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancellationSource",
                table: "recurring_income_occurrences");
        }
    }
}
