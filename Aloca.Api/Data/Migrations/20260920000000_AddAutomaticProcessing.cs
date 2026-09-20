using Aloca.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Aloca.Api.Data.Migrations;

[DbContext(typeof(AlocaDbContext))]
[Migration("20260920000000_AddAutomaticProcessing")]
public partial class AddAutomaticProcessing : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>("AutomaticProcessing", "recurring_incomes", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<DateTime>("ProcessedAt", "recurring_income_occurrences", type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<bool>("AutomaticProcessing", "financial_commitments", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<string>("AutomaticProcessingWarning", "financial_commitments", maxLength: 300, nullable: true);
        migrationBuilder.AddColumn<bool>("WasAutomatic", "commitment_payments", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<DateTime>("ProcessedAt", "transactions", type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("AutomaticProcessing", "recurring_incomes");
        migrationBuilder.DropColumn("ProcessedAt", "recurring_income_occurrences");
        migrationBuilder.DropColumn("AutomaticProcessing", "financial_commitments");
        migrationBuilder.DropColumn("AutomaticProcessingWarning", "financial_commitments");
        migrationBuilder.DropColumn("WasAutomatic", "commitment_payments");
        migrationBuilder.DropColumn("ProcessedAt", "transactions");
    }
}
