using System.Security.Cryptography;
using System.Text;
using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aloca.Api.Services;

public interface IPasswordRecoveryEmailSender
{
    Task SendAsync(string recipientEmail, string rawToken, DateTime expiresAt, CancellationToken cancellationToken);
}

public sealed class PasswordRecoveryService(
    AlocaDbContext db,
    IPasswordRecoveryEmailSender emailSender,
    IBusinessClock clock,
    ILogger<PasswordRecoveryService>? logger = null)
{
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);
    public const string GenericRequestMessage = "Se existir uma conta protegida para este e-mail, a solicitação de recuperação será processada.";
    public const string InvalidTokenMessage = "O link de recuperação é inválido ou expirou.";
    private readonly PasswordHasher<Account> passwordHasher = new();
    private readonly ILogger<PasswordRecoveryService> errorLogger = logger ?? NullLogger<PasswordRecoveryService>.Instance;

    public async Task RequestAsync(string email, CancellationToken ct)
    {
        var account = await db.Accounts.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.NormalizedEmail == AccountService.NormalizeEmail(email) && !x.IsLocal, ct);
        if (account is null || string.IsNullOrWhiteSpace(account.Email) || string.IsNullOrWhiteSpace(account.PasswordHash)) return;

        var now = clock.UtcNow;
        var expiresAt = now.Add(TokenLifetime);
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct)
            : null;

        var previous = await db.PasswordResetTokens
            .Where(x => x.AccountId == account.Id && x.UsedAt == null).ToListAsync(ct);
        foreach (var item in previous) item.MarkUsed(now);

        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        db.PasswordResetTokens.Add(new PasswordResetToken(account.Id, HashToken(rawToken), now, expiresAt));
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
        try
        {
            await emailSender.SendAsync(account.Email, rawToken, expiresAt, ct);
        }
        catch (EmailDeliveryException ex)
        {
            errorLogger.LogError(ex, "Password recovery email delivery failed for account_id={AccountId}.", account.Id);
        }
    }

    public async Task ResetAsync(PasswordResetRequest request, CancellationToken ct)
    {
        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
            throw new PasswordRecoveryException("As senhas não conferem.");
        AccountService.ValidatePassword(request.Password);

        var now = clock.UtcNow;
        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct)
            : null;
        var token = await db.PasswordResetTokens.IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.TokenHash == HashToken(request.Token) && x.UsedAt == null && x.ExpiresAt > now, ct);
        if (token is null) throw new PasswordRecoveryException(InvalidTokenMessage);

        var account = await db.Accounts.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == token.AccountId, ct);
        if (account is null || account.IsLocal || account.PasswordHash is null)
            throw new PasswordRecoveryException(InvalidTokenMessage);

        if (db.Database.IsRelational())
        {
            var consumed = await db.PasswordResetTokens
                .Where(x => x.Id == token.Id && x.UsedAt == null && x.ExpiresAt > now)
                .ExecuteUpdateAsync(update => update.SetProperty(x => x.UsedAt, now), ct);
            if (consumed != 1) throw new PasswordRecoveryException(InvalidTokenMessage);
        }
        else
        {
            token.MarkUsed(now);
        }
        account.ChangePassword(passwordHasher.HashPassword(account, request.Password));
        await db.SaveChangesAsync(ct);
        if (transaction is not null) await transaction.CommitAsync(ct);
    }

    public static string HashToken(string rawToken) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}

public sealed class PasswordRecoveryException(string message) : Exception(message);
