using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Aloca.Api.Tests;

public sealed class PasswordRecoveryTests
{
    [Fact]
    public async Task ProtectedAccountRequestCreatesHashedExpiringTokenAndSendsRawTokenOnlyToSender()
    {
        await using var db = CreateDb();
        var account = ProtectedAccount();
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        var sender = new TestSender();
        var service = Service(db, sender);

        await service.RequestAsync(" Pessoa@Example.com ", default);

        var token = await db.PasswordResetTokens.SingleAsync();
        Assert.NotEqual(sender.RawToken, token.TokenHash);
        Assert.Equal(64, token.TokenHash.Length);
        Assert.Equal(PasswordRecoveryService.TokenLifetime, token.ExpiresAt - token.CreatedAt);
        Assert.Equal(account.Email, sender.Email);
    }

    [Fact]
    public async Task UnknownAndLocalAccountsDoNotCreateTokens()
    {
        await using var db = CreateDb();
        db.Accounts.Add(new Account("Local"));
        db.Accounts.Add(ProtectedAccount("protected@example.com"));
        await db.SaveChangesAsync();
        var sender = new TestSender();
        var service = Service(db, sender);

        await service.RequestAsync("unknown@example.com", default);
        await service.RequestAsync("LOCAL@EXAMPLE.COM", default);

        Assert.Empty(await db.PasswordResetTokens.ToListAsync());
        Assert.Null(sender.RawToken);
    }

    [Fact]
    public async Task LaterRequestInvalidatesPreviousToken()
    {
        await using var db = CreateDb();
        var account = ProtectedAccount();
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        var sender = new TestSender();
        var service = Service(db, sender);

        await service.RequestAsync(account.Email!, default);
        var firstToken = sender.RawToken!;
        await service.RequestAsync(account.Email!, default);
        var secondToken = sender.RawToken!;

        await Assert.ThrowsAsync<PasswordRecoveryException>(() => service.ResetAsync(Reset(firstToken), default));
        await service.ResetAsync(Reset(secondToken), default);
        Assert.NotEqual(firstToken, secondToken);
    }

    [Fact]
    public async Task ResetChangesPasswordRevokesSessionsAndPreservesFinancialData()
    {
        await using var db = CreateDb();
        var account = ProtectedAccount();
        db.Accounts.Add(account);
        db.Transactions.Add(new Transaction("Preservada", 100m, TransactionType.Income, new DateOnly(2026, 9, 1), null));
        await db.SaveChangesAsync();
        var sender = new TestSender();
        var service = Service(db, sender);
        var oldStamp = account.SecurityStamp;
        var oldVersion = account.SessionVersion;
        await service.RequestAsync(account.Email!, default);

        await service.ResetAsync(Reset(sender.RawToken!, "NovaSenha9"), default);

        Assert.NotEqual(oldStamp, account.SecurityStamp);
        Assert.Equal(oldVersion + 1, account.SessionVersion);
        Assert.Equal(100m, await db.Transactions.SumAsync(x => x.Amount));
        var hasher = new PasswordHasher<Account>();
        Assert.Equal(PasswordVerificationResult.Success, hasher.VerifyHashedPassword(account, account.PasswordHash!, "NovaSenha9"));
        Assert.Equal(PasswordVerificationResult.Failed, hasher.VerifyHashedPassword(account, account.PasswordHash!, "SenhaSegura9"));
        Assert.NotNull((await db.PasswordResetTokens.SingleAsync()).UsedAt);
    }

    [Fact]
    public async Task InvalidExpiredAndUsedTokensAreRejectedWithSameMessage()
    {
        await using var db = CreateDb();
        var account = ProtectedAccount();
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        var clock = new FixedClock(new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc));
        var sender = new TestSender();
        var service = Service(db, sender, clock);

        await Assert.ThrowsAsync<PasswordRecoveryException>(() => service.ResetAsync(Reset("invalid-token"), default));
        await service.RequestAsync(account.Email!, default);
        var token = sender.RawToken!;
        clock.Now = clock.Now.AddMinutes(31);
        var expired = await Assert.ThrowsAsync<PasswordRecoveryException>(() => service.ResetAsync(Reset(token), default));
        Assert.Equal(PasswordRecoveryService.InvalidTokenMessage, expired.Message);
    }

    [Fact]
    public async Task InvalidNewPasswordIsRejectedBeforeTokenConsumption()
    {
        await using var db = CreateDb();
        var account = ProtectedAccount();
        db.Accounts.Add(account);
        await db.SaveChangesAsync();
        var sender = new TestSender();
        var service = Service(db, sender);
        await service.RequestAsync(account.Email!, default);

        await Assert.ThrowsAsync<AccountConflictException>(() => service.ResetAsync(Reset(sender.RawToken!, "fraca"), default));
        Assert.Null((await db.PasswordResetTokens.SingleAsync()).UsedAt);
    }

    [Fact]
    public async Task RecoveryMiddlewareDoesNotBootstrapLocalAccount()
    {
        await using var db = CreateDb();
        var accessor = new CurrentUserAccessor();
        var accountService = new AccountService(db, accessor, new TestHostEnvironment());
        var called = false;
        var middleware = new AccountSessionMiddleware(_ => { called = true; return Task.CompletedTask; });
        var context = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() };
        context.Request.Path = "/api/account/password-recovery/request";

        await middleware.InvokeAsync(context, accountService);

        Assert.True(called);
        Assert.Empty(await db.Accounts.ToListAsync());
    }

    private static PasswordRecoveryService Service(AlocaDbContext db, TestSender sender, IBusinessClock? clock = null) =>
        new(db, sender, clock ?? new FixedClock(new DateTime(2026, 9, 26, 12, 0, 0, DateTimeKind.Utc)));

    private static PasswordResetRequest Reset(string token, string password = "NovaSenha9") => new(token, password, password);

    private static Account ProtectedAccount(string email = "pessoa@example.com")
    {
        var account = new Account("Protegida");
        account.Protect("Protegida", new PasswordHasher<Account>().HashPassword(account, "SenhaSegura9"), email);
        return account;
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private sealed class TestSender : IPasswordRecoveryEmailSender
    {
        public string? Email { get; private set; }
        public string? RawToken { get; private set; }
        public Task SendAsync(string recipientEmail, string rawToken, DateTime expiresAt, CancellationToken cancellationToken)
        { Email = recipientEmail; RawToken = rawToken; return Task.CompletedTask; }
    }

    private sealed class FixedClock(DateTime now) : IBusinessClock
    {
        public DateTime Now { get; set; } = now;
        public DateTime UtcNow => Now;
        public DateTime LocalNow => Now;
        public DateOnly Today => DateOnly.FromDateTime(Now);
    }

    private sealed class TestHostEnvironment : Microsoft.Extensions.Hosting.IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Microsoft.Extensions.Hosting.Environments.Development;
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
        public string WebRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = new Microsoft.Extensions.FileProviders.NullFileProvider();
    }
}
