using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class FinancialCommitmentOccurrenceConfiguration : IEntityTypeConfiguration<FinancialCommitmentOccurrence>
{
    public void Configure(EntityTypeBuilder<FinancialCommitmentOccurrence> builder)
    {
        builder.ToTable("financial_commitment_occurrences");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ScheduledDate).HasColumnType("date").IsRequired();
        builder.Property(x => x.Amount).HasPrecision(18, 2).IsRequired();
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(x => new { x.FinancialCommitmentId, x.ScheduledDate }).IsUnique();
        builder.HasOne(x => x.FinancialCommitment).WithMany(x => x.Occurrences).HasForeignKey(x => x.FinancialCommitmentId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.CommitmentPayment).WithMany().HasForeignKey(x => x.CommitmentPaymentId).OnDelete(DeleteBehavior.SetNull);
    }
}
