using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Data;

public sealed class AlocaDbContext(DbContextOptions<AlocaDbContext> options)
    : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<FinancialCommitment> FinancialCommitments => Set<FinancialCommitment>();

    public DbSet<FinancialSettings> FinancialSettings => Set<FinancialSettings>();

    public DbSet<CommitmentPayment> CommitmentPayments => Set<CommitmentPayment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AlocaDbContext).Assembly);
    }
}
