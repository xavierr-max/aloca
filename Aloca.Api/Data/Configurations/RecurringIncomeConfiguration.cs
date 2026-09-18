using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class RecurringIncomeConfiguration : IEntityTypeConfiguration<RecurringIncome>
{
    public void Configure(EntityTypeBuilder<RecurringIncome> builder)
    {
        builder.ToTable("recurring_incomes", t => t.HasCheckConstraint("ck_recurring_incomes_amount_positive", "\"Amount\" > 0"));
        builder.HasKey(x => x.Id); builder.Property(x => x.Description).HasMaxLength(250).IsRequired(); builder.Property(x => x.Amount).HasPrecision(18, 2).IsRequired();
        builder.Property(x => x.Frequency).HasConversion<string>().HasMaxLength(20).IsRequired(); builder.Property(x => x.StartDate).HasColumnType("date"); builder.Property(x => x.EndDate).HasColumnType("date");
        builder.HasIndex(x => new { x.IsActive, x.StartDate }); builder.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId).OnDelete(DeleteBehavior.Restrict);
    }
}
