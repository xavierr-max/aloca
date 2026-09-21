namespace Aloca.Api.Services;

public interface ICurrentUserAccessor
{
    Guid? UserId { get; }
    void Set(Guid? userId);
}

public sealed class CurrentUserAccessor : ICurrentUserAccessor
{
    public Guid? UserId { get; private set; }

    public void Set(Guid? userId) => UserId = userId;
}
