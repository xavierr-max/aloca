using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Aloca.Api.Data.Configurations;

public sealed class FinancialSettingsConfiguration : IEntityTypeConfiguration<FinancialSettings>
{
    public void Configure(EntityTypeBuilder<FinancialSettings> builder)
    {
        builder.ToTable("financial_settings", table =>
            table.HasCheckConstraint("ck_financial_settings_initial_balance_non_negative", "\"InitialBalance\" >= 0"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.InitialBalance).HasPrecision(18, 2).IsRequired();
    }
}
