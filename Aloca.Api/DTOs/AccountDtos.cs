using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed record CurrentAccountDto(Guid Id, string DisplayName, string? Username, string? Email, bool IsProtected, bool IsLocal);
public sealed record AccountListDto(IReadOnlyCollection<CurrentAccountDto> Accounts, CurrentAccountDto? Current, int Limit, bool RequiresLogin);

public sealed record RenameAccountRequest(
    [param: Required, StringLength(80, MinimumLength = 1)] string DisplayName);

public sealed record UpdateProfileRequest(
    [param: Required, StringLength(80, MinimumLength = 1)] string DisplayName,
    [param: Required, EmailAddress, StringLength(254)] string Email);

public sealed record ProtectAccountRequest(
    [param: Required, StringLength(80, MinimumLength = 1)] string DisplayName,
    [param: Required, StringLength(64, MinimumLength = 3)] string Username,
    [param: Required, StringLength(128, MinimumLength = 8)] string Password,
    [param: Required] string ConfirmPassword,
    [param: Required, EmailAddress, StringLength(254)] string Email);

public sealed record LoginRequest(
    [param: Required, StringLength(64, MinimumLength = 3)] string Username,
    [param: Required, StringLength(128, MinimumLength = 1)] string Password);

public sealed record ChangePasswordRequest(
    [param: Required] string CurrentPassword,
    [param: Required, StringLength(128, MinimumLength = 8)] string Password,
    [param: Required] string ConfirmPassword);

public sealed record CreateLocalAccountRequest(
    [param: StringLength(80, MinimumLength = 1)] string? DisplayName = null,
    [param: Required, EmailAddress, StringLength(254)] string? Email = null);

public sealed record ConfirmAccountDeletionRequest(
    [param: Required] string Confirmation,
    string? Password = null);
