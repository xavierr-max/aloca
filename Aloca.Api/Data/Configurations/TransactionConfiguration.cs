using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("transactions", tableBuilder =>
        {
            tableBuilder.HasCheckConstraint("ck_transactions_amount_positive", "\"Amount\" > 0");
            tableBuilder.HasCheckConstraint("ck_transactions_type", "\"Type\" IN ('Income', 'Expense')");
        });

        builder.HasKey(transaction => transaction.Id);

        builder.Property(transaction => transaction.Description)
            .HasMaxLength(250)
            .IsRequired();

        builder.Property(transaction => transaction.Amount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(transaction => transaction.Type)
            .HasConversion<string>()
            .HasMaxLength(16)
            .IsRequired();

        builder.Property(transaction => transaction.Date)
            .HasColumnType("date")
            .IsRequired();

        builder.HasIndex(transaction => new { transaction.CategoryId, transaction.Date });
        builder.HasIndex(transaction => transaction.Date);

        builder.HasOne(transaction => transaction.Category)
            .WithMany(category => category.Transactions)
            .HasForeignKey(transaction => transaction.CategoryId)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired();
    }
}
