using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class CommitmentPaymentConfiguration : IEntityTypeConfiguration<CommitmentPayment>
{
    public void Configure(EntityTypeBuilder<CommitmentPayment> builder)
    {
        builder.ToTable("commitment_payments", table =>
            table.HasCheckConstraint("ck_commitment_payments_amount_positive", "\"Amount\" > 0"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).HasPrecision(18, 2).IsRequired();
        builder.Property(x => x.InstallmentNumber).IsRequired();
        builder.Property(x => x.PaidAt).IsRequired();
        builder.Property(x => x.WasAutomatic).IsRequired();
        builder.HasOne(x => x.FinancialCommitment)
            .WithMany()
            .HasForeignKey(x => x.FinancialCommitmentId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(x => new { x.FinancialCommitmentId, x.InstallmentNumber }).IsUnique();
        builder.HasOne(x => x.FinancialCommitmentOccurrence)
            .WithMany()
            .HasForeignKey(x => x.FinancialCommitmentOccurrenceId)
            .OnDelete(DeleteBehavior.SetNull);
        builder.HasIndex(x => x.FinancialCommitmentOccurrenceId).IsUnique();
    }
}
