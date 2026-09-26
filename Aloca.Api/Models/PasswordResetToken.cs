namespace Aloca.Api.Models;

public sealed class PasswordResetToken
{
    private PasswordResetToken() { }

    public PasswordResetToken(Guid accountId, string tokenHash, DateTime createdAt, DateTime expiresAt)
    {
        Id = Guid.NewGuid(); AccountId = accountId; TokenHash = tokenHash;
        CreatedAt = createdAt; ExpiresAt = expiresAt;
    }

    public Guid Id { get; private set; }
    public Guid AccountId { get; private set; }
    public string TokenHash { get; private set; } = null!;
    public DateTime CreatedAt { get; private set; }
    public DateTime ExpiresAt { get; private set; }
    public DateTime? UsedAt { get; private set; }

    public void MarkUsed(DateTime usedAt) => UsedAt = usedAt;
}
