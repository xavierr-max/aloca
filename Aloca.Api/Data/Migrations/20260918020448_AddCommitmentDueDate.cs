using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCommitmentDueDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DueDate",
                table: "financial_commitments",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(2026, 9, 17));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "financial_commitments");
        }
    }
}
