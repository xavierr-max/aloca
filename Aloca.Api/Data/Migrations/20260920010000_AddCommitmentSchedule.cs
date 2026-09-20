using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations;

public partial class AddCommitmentSchedule : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>("Frequency", "financial_commitments", nullable: false, defaultValue: 3);
        migrationBuilder.AddColumn<DateOnly>("EndDate", "financial_commitments", nullable: true);
        migrationBuilder.AddColumn<bool>("IsRecurring", "financial_commitments", nullable: false, defaultValue: true);
        migrationBuilder.Sql("UPDATE financial_commitments SET \"EndDate\" = (\"DueDate\" + ((\"TotalInstallments\" - 1) * INTERVAL '1 month'))::date WHERE \"TotalInstallments\" > 0");
        migrationBuilder.Sql("UPDATE financial_commitments SET \"Frequency\" = 0, \"IsRecurring\" = false WHERE \"TotalInstallments\" = 1");
        migrationBuilder.Sql("ALTER TABLE financial_commitments DROP CONSTRAINT IF EXISTS ck_financial_commitments_total_installments_positive");
        migrationBuilder.Sql("ALTER TABLE financial_commitments DROP CONSTRAINT IF EXISTS ck_financial_commitments_paid_installments_valid");
        migrationBuilder.AddCheckConstraint(
            name: "ck_financial_commitments_total_installments_positive",
            table: "financial_commitments",
            sql: "\"TotalInstallments\" >= 0");
        migrationBuilder.AddCheckConstraint(
            name: "ck_financial_commitments_paid_installments_valid",
            table: "financial_commitments",
            sql: "\"PaidInstallments\" >= 0 AND (\"TotalInstallments\" = 0 OR \"PaidInstallments\" <= \"TotalInstallments\")");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("Frequency", "financial_commitments");
        migrationBuilder.DropColumn("EndDate", "financial_commitments");
        migrationBuilder.DropColumn("IsRecurring", "financial_commitments");
    }
}
