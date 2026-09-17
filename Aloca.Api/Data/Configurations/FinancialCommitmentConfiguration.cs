using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class FinancialCommitmentConfiguration : IEntityTypeConfiguration<FinancialCommitment>
{
    public void Configure(EntityTypeBuilder<FinancialCommitment> builder)
    {
        builder.ToTable("financial_commitments", tableBuilder =>
        {
            tableBuilder.HasCheckConstraint("ck_financial_commitments_installment_amount_positive", "\"InstallmentAmount\" > 0");
            tableBuilder.HasCheckConstraint("ck_financial_commitments_total_installments_positive", "\"TotalInstallments\" > 0");
            tableBuilder.HasCheckConstraint("ck_financial_commitments_paid_installments_valid", "\"PaidInstallments\" >= 0 AND \"PaidInstallments\" <= \"TotalInstallments\"");
            tableBuilder.HasCheckConstraint("ck_financial_commitments_allocated_amount_non_negative", "\"AllocatedAmount\" >= 0");
            tableBuilder.HasCheckConstraint("ck_financial_commitments_priority_positive", "\"Priority\" > 0");
        });

        builder.HasKey(commitment => commitment.Id);

        builder.Property(commitment => commitment.Name)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(commitment => commitment.InstallmentAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(commitment => commitment.AllocatedAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(commitment => commitment.TotalInstallments).IsRequired();
        builder.Property(commitment => commitment.PaidInstallments).IsRequired();
        builder.Property(commitment => commitment.Priority).IsRequired();
        builder.Property(commitment => commitment.IsFullyCommitted).IsRequired();

        builder.HasOne(commitment => commitment.Category)
            .WithMany()
            .HasForeignKey(commitment => commitment.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(commitment => new { commitment.IsFullyCommitted, commitment.Priority });

        builder.Ignore(commitment => commitment.TotalAmount);
        builder.Ignore(commitment => commitment.RemainingInstallments);
        builder.Ignore(commitment => commitment.RemainingAmount);
        builder.Ignore(commitment => commitment.CoveredInstallments);
        builder.Ignore(commitment => commitment.AmountNeededForNextInstallment);
        builder.Ignore(commitment => commitment.AmountNeededForFullCoverage);
        builder.Ignore(commitment => commitment.ExcessAllocatedAmount);
        builder.Ignore(commitment => commitment.IsCompleted);
    }
}
