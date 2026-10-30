using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class FinancialCommitmentAllocationArchiveConfiguration : IEntityTypeConfiguration<FinancialCommitmentAllocationArchive>
{
    public void Configure(EntityTypeBuilder<FinancialCommitmentAllocationArchive> builder)
    {
        builder.ToTable("financial_commitment_allocation_archive");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.HistoricalAllocatedAmount).HasPrecision(18, 2).IsRequired();
        builder.Property(x => x.HistoricalFullyCommitted).IsRequired();
        builder.Property(x => x.ArchivedAt).IsRequired();
        builder.HasIndex(x => new { x.UserId, x.FinancialCommitmentId }).IsUnique();
        builder.HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
