using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Data;

public sealed class AlocaDbContext(DbContextOptions<AlocaDbContext> options)
    : DbContext(options)
{
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<DeviceAccount> DeviceAccounts => Set<DeviceAccount>();

    private readonly ICurrentUserAccessor? currentUserAccessor = null;

    public AlocaDbContext(DbContextOptions<AlocaDbContext> options, ICurrentUserAccessor currentUserAccessor)
        : this(options)
    {
        this.currentUserAccessor = currentUserAccessor;
    }

    public Guid? CurrentUserId => currentUserAccessor?.UserId;
    public bool TenantFilteringEnabled => currentUserAccessor is not null;
    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<FinancialCommitment> FinancialCommitments => Set<FinancialCommitment>();

    public DbSet<FinancialSettings> FinancialSettings => Set<FinancialSettings>();

    public DbSet<CommitmentPayment> CommitmentPayments => Set<CommitmentPayment>();

    public DbSet<RecurringIncome> RecurringIncomes => Set<RecurringIncome>();

    public DbSet<RecurringIncomeOccurrence> RecurringIncomeOccurrences => Set<RecurringIncomeOccurrence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AlocaDbContext).Assembly);

        modelBuilder.Entity<Category>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<Transaction>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<FinancialCommitment>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<FinancialSettings>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<CommitmentPayment>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<RecurringIncome>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);
        modelBuilder.Entity<RecurringIncomeOccurrence>().HasQueryFilter(x => !TenantFilteringEnabled || x.UserId == CurrentUserId);

        modelBuilder.Entity<Category>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Transaction>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<FinancialCommitment>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<FinancialSettings>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<CommitmentPayment>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<RecurringIncome>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<RecurringIncomeOccurrence>().HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        PrepareOwnedEntities();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        PrepareOwnedEntities();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void PrepareOwnedEntities()
    {
        if (!TenantFilteringEnabled) return;
        var ownedEntries = ChangeTracker.Entries().Where(x => x.State == EntityState.Added && x.Metadata.FindProperty("UserId") is not null).ToList();
        if (ownedEntries.Count == 0) return;
        if (!CurrentUserId.HasValue) throw new UnauthorizedAccessException("A conta atual não foi autenticada.");

        foreach (var entry in ownedEntries)
            entry.Property("UserId").CurrentValue = CurrentUserId.Value;
    }
}
