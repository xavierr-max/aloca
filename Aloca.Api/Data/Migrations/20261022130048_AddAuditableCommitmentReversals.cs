using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aloca.Api.Data.Migrations;

public partial class AddAuditableCommitmentReversals : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>("ReversedAt", "commitment_payments", nullable: true);
        migrationBuilder.AddColumn<Guid>("ReversalTransactionId", "commitment_payments", nullable: true);
        migrationBuilder.AddColumn<Guid>("ReversesTransactionId", "transactions", nullable: true);

        migrationBuilder.CreateIndex("IX_commitment_payments_ReversalTransactionId", "commitment_payments", "ReversalTransactionId", unique: true, filter: "\"ReversalTransactionId\" IS NOT NULL");
        migrationBuilder.CreateIndex("IX_transactions_ReversesTransactionId", "transactions", "ReversesTransactionId", unique: true, filter: "\"ReversesTransactionId\" IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex("IX_commitment_payments_ReversalTransactionId", "commitment_payments");
        migrationBuilder.DropIndex("IX_transactions_ReversesTransactionId", "transactions");
        migrationBuilder.DropColumn("ReversedAt", "commitment_payments");
        migrationBuilder.DropColumn("ReversalTransactionId", "commitment_payments");
        migrationBuilder.DropColumn("ReversesTransactionId", "transactions");
    }
}
