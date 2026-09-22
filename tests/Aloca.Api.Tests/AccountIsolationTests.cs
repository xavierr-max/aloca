using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class AccountIsolationTests
{
    [Fact]
    public async Task FirstUseCreatesOneLocalAccountAndRepeatedBootstrapReusesIt()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);

        await service.EnsureSessionAsync(context, default);
        var firstId = accessor.UserId;
        await service.EnsureSessionAsync(context, default);

        Assert.NotNull(firstId);
        Assert.Equal(firstId, accessor.UserId);
        Assert.Single(await db.Accounts.ToListAsync());
        Assert.True((await service.GetAccountsAsync(context, default)).Current!.IsLocal);
    }

    [Fact]
    public async Task BootstrapCreatesLocalFallbackWhenOnlyProtectedAccountHasNoValidSession()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);

        await service.EnsureSessionAsync(context, default);
        await service.ProtectAsync(context, new("Protegida", "protegida", "SenhaSegura9", "SenhaSegura9", "protegida@example.com"), default);
        var protectedAccount = await db.Accounts.IgnoreQueryFilters().SingleAsync();
        protectedAccount.RevokeSessions();
        await db.SaveChangesAsync();

        await service.EnsureSessionAsync(context, default);

        var current = await service.GetAccountsAsync(context, default);
        Assert.NotNull(current.Current);
        Assert.True(current.Current!.IsLocal);
        Assert.Contains(current.Accounts, account => account.IsProtected);
        Assert.Equal(2, await db.Accounts.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task ProtectingAccountKeepsUserIdAndFinancialRows()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        var account = new Account("Pessoal");
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        accessor.Set(account.Id);
        var category = new Category("Casa");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var transaction = new Transaction("Salário", 100m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), category.Id);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var oldId = account.Id;
        var oldSecurityStamp = account.SecurityStamp;
        var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Account>();
        account.Protect("Pessoal", "maxwell", AccountService.NormalizeUsername("maxwell"), hasher.HashPassword(account, "SenhaSegura9"));
        await db.SaveChangesAsync();

        Assert.Equal(oldId, account.Id);
        Assert.NotEqual(oldSecurityStamp, account.SecurityStamp);
        Assert.False(account.IsLocal);
        Assert.Equal(transaction.Id, await db.Transactions.Select(x => x.Id).SingleAsync());
        Assert.Equal(account.Id, await db.Transactions.Select(x => x.UserId).SingleAsync());
        Assert.Equal(PasswordVerificationResult.Success, hasher.VerifyHashedPassword(account, account.PasswordHash!, "SenhaSegura9"));
    }

    [Fact]
    public async Task MissingCurrentUserFailsClosedAndCannotSeeAnotherAccount()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        var account = new Account("A");
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        accessor.Set(account.Id);
        db.Categories.Add(new Category("Privada"));
        await db.SaveChangesAsync();

        accessor.Set(null);

        Assert.Empty(await db.Categories.ToListAsync());
        db.Transactions.Add(new Transaction("Tentativa", 10m, TransactionType.Expense, DateOnly.FromDateTime(DateTime.UtcNow), null));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public void AccountLimitIsFourAndSessionVersionChangesOnSecurityAction()
    {
        var account = new Account("Conta");
        var version = account.SessionVersion;
        account.RevokeSessions();

        Assert.Equal(4, AccountService.MaxDeviceAccounts);
        Assert.Equal(version + 1, account.SessionVersion);
        Assert.NotEqual(string.Empty, account.SecurityStamp);
    }

    [Fact]
    public async Task DeletingAccountRemovesItsFinancialRowsAndStartsAReplacementLocalSession()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var account = new Account("Apagar");
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        accessor.Set(account.Id);
        var category = new Category("Temporária");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        db.Transactions.Add(new Transaction("Saída", 25m, TransactionType.Expense, DateOnly.FromDateTime(DateTime.UtcNow), category.Id));
        await db.SaveChangesAsync();

        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        await service.DeleteCurrentAsync(NewHttpContext(provider), new(AccountService.LocalAccountDeletionConfirmation), default);

        Assert.DoesNotContain(await db.Accounts.IgnoreQueryFilters().ToListAsync(), x => x.Id == account.Id);
        Assert.Empty(await db.Transactions.IgnoreQueryFilters().Where(x => x.UserId == account.Id).ToListAsync());
        Assert.Empty(await db.Categories.IgnoreQueryFilters().Where(x => x.UserId == account.Id).ToListAsync());
        Assert.True((await db.Accounts.IgnoreQueryFilters().CountAsync()) >= 1);
    }

    [Fact]
    public async Task ProtectedAccountDeletionRequiresCurrentPasswordAndThenRemovesData()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);

        await service.EnsureSessionAsync(context, default);
        await service.ProtectAsync(context, new("Protegida", "protegida", "SenhaSegura9", "SenhaSegura9", "protegida@example.com"), default);
        var accountId = accessor.UserId!.Value;
        db.Transactions.Add(new Transaction("Privada", 90m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), null));
        await db.SaveChangesAsync();

        await Assert.ThrowsAsync<AccountAuthenticationException>(() => service.DeleteCurrentAsync(
            context, new("Protegida", "SenhaErrada9"), default));
        Assert.NotNull(await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == accountId));

        await service.DeleteCurrentAsync(context, new("Protegida", "SenhaSegura9"), default);

        Assert.Null(await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == accountId));
        Assert.Empty(await db.Transactions.IgnoreQueryFilters().Where(x => x.UserId == accountId).ToListAsync());
        Assert.DoesNotContain(await db.DeviceAccounts.ToListAsync(), x => x.AccountId == accountId);
    }

    [Fact]
    public async Task LocalAccountDeletionRequiresTheStrongExplicitConfirmation()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);

        await service.EnsureSessionAsync(context, default);
        var accountId = accessor.UserId!.Value;

        await Assert.ThrowsAsync<AccountConflictException>(() => service.DeleteCurrentAsync(context, new("Minha conta"), default));
        Assert.NotNull(await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == accountId));

        await service.DeleteCurrentAsync(context, new(AccountService.LocalAccountDeletionConfirmation), default);

        Assert.Null(await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == accountId));
    }

    [Fact]
    public async Task ProtectedAccountCanBeRemovedFromDeviceWithoutDeletingItsData()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);

        await service.EnsureSessionAsync(context, default);
        var local = await db.Accounts.SingleAsync();
        var transaction = new Transaction("Preservada", 50m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), null);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();
        await service.ProtectAsync(context, new("Protegida", "protegida", "SenhaSegura9", "SenhaSegura9", "protegida@example.com"), default);

        await service.RemoveFromDeviceAsync(context, default);

        Assert.DoesNotContain(await db.DeviceAccounts.ToListAsync(), x => x.AccountId == local.Id);
        Assert.NotNull(await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == local.Id));
        Assert.NotNull(await db.Transactions.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == transaction.Id));
        Assert.DoesNotContain((await service.GetAccountsAsync(context, default)).Accounts, x => x.Id == local.Id);
    }

    [Fact]
    public async Task LocalAccountCannotBeRemovedFromDevice()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);
        await service.EnsureSessionAsync(context, default);

        await Assert.ThrowsAsync<AccountConflictException>(() => service.RemoveFromDeviceAsync(context, default));
        Assert.Single(await db.DeviceAccounts.ToListAsync());
    }

    [Fact]
    public async Task ProfileRequiresValidUniqueEmailAndNormalizesIt()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);
        await service.EnsureSessionAsync(context, default);

        var current = await service.UpdateProfileAsync(new UpdateProfileRequest("  Atualizada ", " Pessoa@Example.com "), default);
        Assert.Equal("Atualizada", current.DisplayName);
        Assert.Equal("Pessoa@Example.com", current.Email);
        Assert.Equal("PESSOA@EXAMPLE.COM", await db.Accounts.Select(x => x.NormalizedEmail).SingleAsync());

        var other = new Account("Outra", true, "outro@example.com");
        db.Accounts.Add(other);
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<AccountConflictException>(() => service.UpdateProfileAsync(new("Atualizada", "OUTRO@example.com"), default));
        await Assert.ThrowsAsync<AccountConflictException>(() => service.UpdateProfileAsync(new("Atualizada", "invalido"), default));
    }

    [Fact]
    public async Task CreatingLocalAccountRequiresValidUniqueEmail()
    {
        var accessor = new CurrentUserAccessor();
        await using var db = CreateDb(accessor);
        using var provider = CreateAuthProvider();
        var service = new AccountService(db, accessor, provider.GetRequiredService<IHostEnvironment>());
        var context = NewHttpContext(provider);
        await service.EnsureSessionAsync(context, default);

        var created = await service.CreateLocalAsync(context, new("Nova", "novo@example.com"), default);
        Assert.Equal("novo@example.com", created.Email);
        await Assert.ThrowsAsync<AccountConflictException>(() => service.CreateLocalAsync(context, new("Duplicada", "NOVO@example.com"), default));
        await Assert.ThrowsAsync<AccountConflictException>(() => service.CreateLocalAsync(context, new("Inválida", "sem-email"), default));
    }

    private static AlocaDbContext CreateDb(ICurrentUserAccessor accessor) => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options, accessor);

    private static DefaultHttpContext NewHttpContext(IServiceProvider provider) => new() { RequestServices = provider };

    private static ServiceProvider CreateAuthProvider()
    {
        var services = new ServiceCollection();
        services.AddDataProtection();
        services.AddLogging();
        services.AddAuthentication(AccountService.AuthScheme).AddCookie(AccountService.AuthScheme, options => options.Cookie.Name = AccountService.AuthScheme);
        services.AddSingleton<IHostEnvironment>(new TestHostEnvironment());
        return services.BuildServiceProvider();
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
}
