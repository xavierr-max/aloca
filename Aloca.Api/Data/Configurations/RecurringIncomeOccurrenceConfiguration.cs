using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class RecurringIncomeOccurrenceConfiguration : IEntityTypeConfiguration<RecurringIncomeOccurrence>
{
    public void Configure(EntityTypeBuilder<RecurringIncomeOccurrence> builder)
    {
        builder.ToTable("recurring_income_occurrences"); builder.HasKey(x => x.Id); builder.Property(x => x.ScheduledDate).HasColumnType("date"); builder.Property(x => x.Amount).HasPrecision(18, 2); builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        builder.HasIndex(x => new { x.RecurringIncomeId, x.ScheduledDate }).IsUnique();
        builder.HasOne(x => x.RecurringIncome).WithMany(x => x.Occurrences).HasForeignKey(x => x.RecurringIncomeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Transaction).WithMany().HasForeignKey(x => x.TransactionId).OnDelete(DeleteBehavior.SetNull);
    }
}
