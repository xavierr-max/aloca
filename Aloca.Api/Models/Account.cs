using System.Text.RegularExpressions;

namespace Aloca.Api.Models;

public sealed class Account
{
    private Account() { }

    public Account(string displayName, bool isLocal = true, string? email = null)
    {
        if (isLocal && !string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Contas locais não possuem e-mail.", nameof(email));
        Id = Guid.NewGuid();
        DisplayName = ValidateDisplayName(displayName);
        Email = email is null ? null : ValidateEmail(email);
        NormalizedEmail = Email is null ? null : NormalizeEmail(Email);
        IsLocal = isLocal;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = CreatedAt;
        SecurityStamp = CreateStamp();
        SessionVersion = 1;
    }

    public Guid Id { get; private set; }
    public string DisplayName { get; private set; } = null!;
    public string? AvatarFileName { get; private set; }
    public string? Email { get; private set; }
    public string? NormalizedEmail { get; private set; }
    public string? PasswordHash { get; private set; }
    public bool IsLocal { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public string SecurityStamp { get; private set; } = null!;
    public int SessionVersion { get; private set; }

    public void Rename(string displayName)
    {
        DisplayName = ValidateDisplayName(displayName);
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetAvatar(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > 120 || Path.GetFileName(fileName) != fileName)
            throw new ArgumentException("A referência da foto de perfil é inválida.", nameof(fileName));
        AvatarFileName = fileName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveAvatar()
    {
        AvatarFileName = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetEmail(string email)
    {
        if (IsLocal) throw new InvalidOperationException("Contas locais não possuem e-mail.");
        Email = ValidateEmail(email);
        NormalizedEmail = NormalizeEmail(Email);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Protect(string displayName, string passwordHash, string email)
    {
        DisplayName = ValidateDisplayName(displayName);
        PasswordHash = passwordHash;
        IsLocal = false;
        SetEmail(email);
        TouchSecurity();
    }

    public void ChangePassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        TouchSecurity();
    }

    public void RevokeSessions() => TouchSecurity();

    private void TouchSecurity()
    {
        SecurityStamp = CreateStamp();
        SessionVersion++;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string ValidateDisplayName(string displayName)
    {
        if (string.IsNullOrWhiteSpace(displayName)) throw new ArgumentException("O nome da conta é obrigatório.", nameof(displayName));
        var value = displayName.Trim();
        if (value.Length > 80) throw new ArgumentException("O nome da conta deve ter no máximo 80 caracteres.", nameof(displayName));
        return value;
    }

    private static string ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !Regex.IsMatch(email.Trim(), @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new ArgumentException("Informe um e-mail válido.", nameof(email));
        var value = email.Trim();
        if (value.Length > 254) throw new ArgumentException("O e-mail deve ter no máximo 254 caracteres.", nameof(email));
        return value;
    }

    private static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();

    private static string CreateStamp() => Guid.NewGuid().ToString("N");
}

public sealed class Device
{
    private Device() { }

    public Device(string tokenHash)
    {
        Id = Guid.NewGuid();
        TokenHash = tokenHash;
        CreatedAt = DateTime.UtcNow;
        LastSeenAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public string TokenHash { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public DateTime LastSeenAt { get; private set; }
    public ICollection<DeviceAccount> Accounts { get; private set; } = new List<DeviceAccount>();

    public void Touch() => LastSeenAt = DateTime.UtcNow;
}

public sealed class DeviceAccount
{
    private DeviceAccount() { }

    public DeviceAccount(Guid deviceId, Guid accountId)
    {
        DeviceId = deviceId;
        AccountId = accountId;
        AddedAt = DateTime.UtcNow;
        LastUsedAt = AddedAt;
    }

    public Guid DeviceId { get; private set; }
    public Guid AccountId { get; private set; }
    public DateTime AddedAt { get; private set; }
    public DateTime LastUsedAt { get; private set; }
    public Device Device { get; private set; } = null!;
    public Account Account { get; private set; } = null!;

    public void MarkUsed() => LastUsedAt = DateTime.UtcNow;
}
