using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class AccountLimitExceededException : Exception
{
    public AccountLimitExceededException() : base("Você já possui o limite de 4 contas neste dispositivo. Remova uma conta para adicionar outra.") { }
}

public sealed class AccountAuthenticationException : Exception
{
    public AccountAuthenticationException() : base("Não foi possível autenticar. Confira o e-mail e a senha.") { }
}

public sealed class AccountConflictException(string message) : Exception(message);

public sealed class AccountService(
    AlocaDbContext db,
    ICurrentUserAccessor currentUser,
    IHostEnvironment environment)
{
    public const string LocalAccountDeletionConfirmation = "APAGAR MINHA CONTA";
    public const int MaxDeviceAccounts = 4;
    public const string DeviceCookieName = "aloca.device";
    public const string AuthScheme = "aloca.auth";
    private const string DeviceItemKey = "aloca.device.entity";
    private readonly PasswordHasher<Account> passwordHasher = new();

    public async Task EnsureSessionAsync(HttpContext httpContext, CancellationToken ct)
    {
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var principal = (await httpContext.AuthenticateAsync(AuthScheme)).Principal;

        if (principal?.Identity?.IsAuthenticated == true && await TryRestoreAuthenticatedSessionAsync(httpContext, principal, device, ct))
            return;

        await SignOutAsync(httpContext);
        currentUser.Set(null);

        var local = await db.DeviceAccounts
            .Where(x => x.DeviceId == device.Id && x.Account.IsLocal)
            .OrderByDescending(x => x.LastUsedAt)
            .Select(x => x.Account)
            .FirstOrDefaultAsync(ct);

        if (local is null)
        {
            local = await FindUnassignedMigratedAccountAsync(ct);
            if (local is not null)
            {
                db.DeviceAccounts.Add(new DeviceAccount(device.Id, local.Id));
                await db.SaveChangesAsync(ct);
            }
        }

        if (local is null)
        {
            if (await DeviceAccountCountAsync(device.Id, ct) >= MaxDeviceAccounts)
                return;

            local = new Account("Minha conta");
            db.Accounts.Add(local);
            db.DeviceAccounts.Add(new DeviceAccount(device.Id, local.Id));
            await db.SaveChangesAsync(ct);
        }

        await SignInAsync(httpContext, local, device, ct);
    }

    public async Task LogoutAsync(HttpContext httpContext)
    {
        await SignOutAsync(httpContext);
        currentUser.Set(null);
    }

    public async Task<AccountListDto> GetAccountsAsync(HttpContext httpContext, CancellationToken ct)
    {
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var rows = await db.DeviceAccounts
            .Where(x => x.DeviceId == device.Id)
            .Include(x => x.Account)
            .OrderByDescending(x => x.LastUsedAt)
            .ToListAsync(ct);
        var current = currentUser.UserId.HasValue
            ? rows.FirstOrDefault(x => x.AccountId == currentUser.UserId.Value)?.Account
              ?? await db.Accounts.SingleOrDefaultAsync(x => x.Id == currentUser.UserId.Value, ct)
            : null;
        return new(rows.Select(x => ToDto(x.Account, current?.Id == x.Account.Id)).ToList(), current is null ? null : ToDto(current), MaxDeviceAccounts,
            currentUser.UserId is null && rows.Any(x => !x.Account.IsLocal));
    }

    public async Task<CurrentAccountDto> ContinueLocalAsync(HttpContext httpContext, CancellationToken ct)
    {
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var local = await db.DeviceAccounts
            .Where(x => x.DeviceId == device.Id && x.Account.IsLocal)
            .OrderByDescending(x => x.LastUsedAt)
            .Select(x => x.Account)
            .FirstOrDefaultAsync(ct);
        if (local is null)
        {
            local = await FindUnassignedMigratedAccountAsync(ct);
            if (local is not null)
            {
                db.DeviceAccounts.Add(new DeviceAccount(device.Id, local.Id));
                await db.SaveChangesAsync(ct);
            }
        }

        if (local is null)
        {
            EnsureCapacity(await DeviceAccountCountAsync(device.Id, ct));
            local = new Account("Minha conta");
            db.Accounts.Add(local);
            db.DeviceAccounts.Add(new DeviceAccount(device.Id, local.Id));
            await db.SaveChangesAsync(ct);
        }

        await SignInAsync(httpContext, local, device, ct);
        return ToDto(local);
    }

    public async Task<CurrentAccountDto> CreateLocalAsync(HttpContext httpContext, CreateLocalAccountRequest request, CancellationToken ct)
    {
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        EnsureCapacity(await DeviceAccountCountAsync(device.Id, ct));
        var local = new Account(string.IsNullOrWhiteSpace(request.DisplayName) ? "Minha conta" : request.DisplayName!);
        db.Accounts.Add(local);
        db.DeviceAccounts.Add(new DeviceAccount(device.Id, local.Id));
        await db.SaveChangesAsync(ct);
        await SignInAsync(httpContext, local, device, ct);
        return ToDto(local);
    }

    public async Task<CurrentAccountDto> LoginAsync(HttpContext httpContext, LoginRequest request, CancellationToken ct)
    {
        var normalized = NormalizeEmail(request.Email);
        var account = await db.Accounts.SingleOrDefaultAsync(x => x.NormalizedEmail == normalized && !x.IsLocal, ct);
        if (account is null || account.PasswordHash is null || passwordHasher.VerifyHashedPassword(account, account.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            throw new AccountAuthenticationException();

        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var link = await db.DeviceAccounts.SingleOrDefaultAsync(x => x.DeviceId == device.Id && x.AccountId == account.Id, ct);
        if (link is null)
        {
            EnsureCapacity(await DeviceAccountCountAsync(device.Id, ct));
            db.DeviceAccounts.Add(link = new DeviceAccount(device.Id, account.Id));
        }

        link.MarkUsed();
        await db.SaveChangesAsync(ct);
        await SignInAsync(httpContext, account, device, ct);
        return ToDto(account);
    }

    public async Task<CurrentAccountDto> RenameAsync(RenameAccountRequest request, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        account.Rename(request.DisplayName);
        await db.SaveChangesAsync(ct);
        return ToDto(account);
    }

    public async Task<CurrentAccountDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (account.IsLocal)
        {
            account.Rename(request.DisplayName);
            await db.SaveChangesAsync(ct);
            return ToDto(account);
        }

        var email = ValidateEmail(request.Email);
        await EnsureEmailAvailableAsync(email, account.Id, ct);
        account.Rename(request.DisplayName);
        account.SetEmail(email);
        await db.SaveChangesAsync(ct);
        return ToDto(account);
    }

    public async Task<CurrentAccountDto> ProtectAsync(HttpContext httpContext, ProtectAccountRequest request, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (!account.IsLocal) throw new AccountConflictException("Esta conta já está protegida.");
        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal)) throw new AccountConflictException("As senhas não conferem.");
        ValidatePassword(request.Password);
        var email = ValidateEmail(request.Email);
        await EnsureEmailAvailableAsync(email, account.Id, ct);
        account.Protect(request.DisplayName, passwordHasher.HashPassword(account, request.Password), email);
        await db.SaveChangesAsync(ct);
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        await SignInAsync(httpContext, account, device, ct);
        return ToDto(account);
    }

    public async Task<CurrentAccountDto> ChangePasswordAsync(HttpContext httpContext, ChangePasswordRequest request, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (account.IsLocal || account.PasswordHash is null || passwordHasher.VerifyHashedPassword(account, account.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            throw new AccountAuthenticationException();
        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal)) throw new AccountConflictException("As senhas não conferem.");
        ValidatePassword(request.Password);
        account.ChangePassword(passwordHasher.HashPassword(account, request.Password));
        await db.SaveChangesAsync(ct);
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        await SignInAsync(httpContext, account, device, ct);
        return ToDto(account);
    }

    public async Task<CurrentAccountDto?> SwitchAsync(HttpContext httpContext, Guid accountId, CancellationToken ct)
    {
        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var link = await db.DeviceAccounts.Include(x => x.Account).SingleOrDefaultAsync(x => x.DeviceId == device.Id && x.AccountId == accountId, ct);
        if (link is null) return null;
        link.MarkUsed();
        await db.SaveChangesAsync(ct);
        await SignInAsync(httpContext, link.Account, device, ct);
        return ToDto(link.Account);
    }

    public async Task RemoveFromDeviceAsync(HttpContext httpContext, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (account.IsLocal)
            throw new AccountConflictException("Contas locais só podem ser excluídas; não podem ser removidas sem apagar seus dados.");

        var device = await GetOrCreateDeviceAsync(httpContext, ct);
        var links = await db.DeviceAccounts
            .Where(x => x.DeviceId == device.Id && x.AccountId == account.Id)
            .ToListAsync(ct);
        if (links.Count > 0) db.DeviceAccounts.RemoveRange(links);
        await db.SaveChangesAsync(ct);
        await SignOutAsync(httpContext);
        currentUser.Set(null);
        await EnsureSessionAsync(httpContext, ct);
    }

    public async Task DeleteCurrentAsync(HttpContext httpContext, ConfirmAccountDeletionRequest request, CancellationToken ct)
    {
        var account = await GetCurrentAccountAsync(ct);
        if (account.IsLocal)
        {
            if (!string.Equals(request.Confirmation.Trim(), LocalAccountDeletionConfirmation, StringComparison.Ordinal))
                throw new AccountConflictException($"Digite exatamente {LocalAccountDeletionConfirmation} para confirmar a exclusão da conta local.");
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.Password)
                || account.PasswordHash is null
                || passwordHasher.VerifyHashedPassword(account, account.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
                throw new AccountAuthenticationException();
            if (!string.Equals(request.Confirmation.Trim(), account.DisplayName, StringComparison.Ordinal))
                throw new AccountConflictException("Digite exatamente o nome da conta para confirmar a exclusão.");
        }

        var userId = account.Id;
        var occurrences = await db.RecurringIncomeOccurrences.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var recurring = await db.RecurringIncomes.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var transactions = await db.Transactions.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var payments = await db.CommitmentPayments.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var commitments = await db.FinancialCommitments.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var categories = await db.Categories.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var settings = await db.FinancialSettings.IgnoreQueryFilters().Where(x => x.UserId == userId).ToListAsync(ct);
        var deviceLinks = await db.DeviceAccounts.Where(x => x.AccountId == userId).ToListAsync(ct);
        var deviceIds = deviceLinks.Select(x => x.DeviceId).Distinct().ToList();

        db.RemoveRange(occurrences);
        db.RemoveRange(recurring);
        db.RemoveRange(payments);
        db.RemoveRange(commitments);
        db.RemoveRange(transactions);
        db.RemoveRange(settings);
        db.RemoveRange(categories);
        db.RemoveRange(deviceLinks);
        db.Accounts.Remove(account);
        await db.SaveChangesAsync(ct);

        var orphanedDevices = await db.Devices
            .Where(x => deviceIds.Contains(x.Id) && !db.DeviceAccounts.Any(link => link.DeviceId == x.Id))
            .ToListAsync(ct);
        if (orphanedDevices.Count > 0)
        {
            db.Devices.RemoveRange(orphanedDevices);
            await db.SaveChangesAsync(ct);
        }

        // Remove persistent device associations before establishing the next local session.
        // The authentication cookie is also explicitly signed out so a deleted session cannot be reused.
        await SignOutAsync(httpContext);
        currentUser.Set(null);
        await EnsureSessionAsync(httpContext, ct);
    }

    public async Task<Account?> GetAuthenticatedAccountAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(idValue, out var id)) return null;
        var account = await db.Accounts.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (account is null) return null;
        var stamp = principal.FindFirstValue("aloca_security_stamp");
        var version = principal.FindFirstValue("aloca_session_version");
        return stamp == account.SecurityStamp && int.TryParse(version, out var parsedVersion) && parsedVersion == account.SessionVersion ? account : null;
    }

    private async Task<bool> TryRestoreAuthenticatedSessionAsync(HttpContext httpContext, ClaimsPrincipal principal, Device device, CancellationToken ct)
    {
        var account = await GetAuthenticatedAccountAsync(principal, ct);
        if (account is null) return false;
        var link = await db.DeviceAccounts.SingleOrDefaultAsync(x => x.DeviceId == device.Id && x.AccountId == account.Id, ct);
        // A sessão persistente autoriza a troca de contexto somente enquanto a
        // associação deste dispositivo existir. Login explícito é o único fluxo
        // que pode criar uma associação novamente.
        if (link is null) return false;

        currentUser.Set(account.Id);
        link.MarkUsed();
        await db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<Account> GetCurrentAccountAsync(CancellationToken ct)
    {
        if (!currentUser.UserId.HasValue) throw new UnauthorizedAccessException("A conta atual não foi autenticada.");
        return await db.Accounts.SingleOrDefaultAsync(x => x.Id == currentUser.UserId.Value, ct)
            ?? throw new UnauthorizedAccessException("A sessão da conta é inválida.");
    }

    private async Task<Device> GetOrCreateDeviceAsync(HttpContext httpContext, CancellationToken ct)
    {
        if (httpContext.Items[DeviceItemKey] is Device cached) return cached;
        var raw = httpContext.Request.Cookies[DeviceCookieName];
        Device? device = null;
        if (!string.IsNullOrWhiteSpace(raw))
            device = await db.Set<Device>().SingleOrDefaultAsync(x => x.TokenHash == HashToken(raw), ct);
        if (device is null)
        {
            raw = CreateToken();
            device = new Device(HashToken(raw));
            db.Set<Device>().Add(device);
            await db.SaveChangesAsync(ct);
            SetDeviceCookie(httpContext, raw);
        }
        httpContext.Items[DeviceItemKey] = device;
        return device;
    }

    private async Task<int> DeviceAccountCountAsync(Guid deviceId, CancellationToken ct) => await db.DeviceAccounts.CountAsync(x => x.DeviceId == deviceId, ct);

    private Task<Account?> FindUnassignedMigratedAccountAsync(CancellationToken ct) => db.Accounts
        .Where(x => x.IsLocal && x.SecurityStamp.StartsWith("migration-") && !db.DeviceAccounts.Any(link => link.AccountId == x.Id))
        .OrderBy(x => x.CreatedAt)
        .FirstOrDefaultAsync(ct);

    private async Task SignInAsync(HttpContext httpContext, Account account, Device device, CancellationToken ct)
    {
        currentUser.Set(account.Id);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.DisplayName),
            new Claim("aloca_security_stamp", account.SecurityStamp),
            new Claim("aloca_session_version", account.SessionVersion.ToString())
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, AuthScheme));
        await httpContext.SignInAsync(AuthScheme, principal, new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(14), AllowRefresh = true });
        var link = await db.DeviceAccounts.SingleOrDefaultAsync(x => x.DeviceId == device.Id && x.AccountId == account.Id, ct);
        if (link is not null)
        {
            link.MarkUsed();
            await db.SaveChangesAsync(ct);
        }
    }

    private static Task SignOutAsync(HttpContext httpContext) => httpContext.SignOutAsync(AuthScheme);

    private void SetDeviceCookie(HttpContext httpContext, string value) => httpContext.Response.Cookies.Append(DeviceCookieName, value, new CookieOptions
    {
        HttpOnly = true,
        Secure = httpContext.Request.IsHttps || !environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        IsEssential = true,
        Path = "/",
        MaxAge = TimeSpan.FromDays(90)
    });

    private static string CreateToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static string HashToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    private static string ValidateEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || !Regex.IsMatch(email.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new AccountConflictException("Informe um e-mail válido.");
        var value = email.Trim();
        if (value.Length > 254) throw new AccountConflictException("O e-mail deve ter no máximo 254 caracteres.");
        return value;
    }

    private async Task EnsureEmailAvailableAsync(string email, Guid? accountId, CancellationToken ct)
    {
        var normalized = NormalizeEmail(email);
        if (await db.Accounts.AnyAsync(x => x.NormalizedEmail == normalized && (!accountId.HasValue || x.Id != accountId.Value), ct))
            throw new AccountConflictException("Este e-mail já está em uso.");
    }

    private static void ValidatePassword(string password)
    {
        if (password.Length < 8 || !password.Any(char.IsUpper) || !password.Any(char.IsLower) || !password.Any(char.IsDigit))
            throw new AccountConflictException("A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula e número.");
    }

    private static void EnsureCapacity(int count)
    {
        if (count >= MaxDeviceAccounts) throw new AccountLimitExceededException();
    }

    private static CurrentAccountDto ToDto(Account account, bool includeEmail = true) => new(account.Id, account.DisplayName, includeEmail ? account.Email : null, !account.IsLocal, account.IsLocal);
}

public sealed class AccountSessionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, AccountService accounts)
    {
        if (context.Request.Path.StartsWithSegments("/api"))
            await accounts.EnsureSessionAsync(context, context.RequestAborted);

        await next(context);
    }
}
