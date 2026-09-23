using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/account"), AllowAnonymous]
public sealed class AccountController(AccountService service) : ControllerBase
{
    [HttpGet("current")]
    public async Task<ActionResult<AccountListDto>> Current(CancellationToken ct) => Ok(await service.GetAccountsAsync(HttpContext, ct));

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        await service.LogoutAsync(HttpContext);
        return NoContent();
    }

    [HttpPost("local/continue"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> ContinueLocal(CancellationToken ct)
    {
        try { return Ok(await service.ContinueLocalAsync(HttpContext, ct)); }
        catch (AccountLimitExceededException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("local"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> CreateLocal(CreateLocalAccountRequest request, CancellationToken ct)
    {
        try { return Ok(await service.CreateLocalAsync(HttpContext, request, ct)); }
        catch (AccountLimitExceededException ex) { return Conflict(new { message = ex.Message }); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("login"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> Login(LoginRequest request, CancellationToken ct)
    {
        try { return Ok(await service.LoginAsync(HttpContext, request, ct)); }
        catch (AccountAuthenticationException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (AccountLimitExceededException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("protect"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> Protect(ProtectAccountRequest request, CancellationToken ct)
    {
        try { return Ok(await service.ProtectAsync(HttpContext, request, ct)); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpPatch("profile"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> UpdateProfile(UpdateProfileRequest request, CancellationToken ct)
    {
        try { return Ok(await service.UpdateProfileAsync(request, ct)); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("avatar")]
    public async Task<IActionResult> Avatar(CancellationToken ct)
    {
        var avatar = await service.GetCurrentAvatarAsync(ct);
        return avatar is null ? NotFound() : PhysicalFile(avatar.Value.Path, avatar.Value.ContentType, enableRangeProcessing: false);
    }

    [HttpPost("avatar"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> UploadAvatar(IFormFile? file, CancellationToken ct)
    {
        try { return Ok(await service.SetAvatarAsync(file, ct)); }
        catch (AccountConflictException ex) { return BadRequest(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpDelete("avatar"), EnableRateLimiting("account")]
    public async Task<IActionResult> DeleteAvatar(CancellationToken ct)
    {
        try { await service.RemoveAvatarAsync(ct); return NoContent(); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpPatch("rename"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> Rename(RenameAccountRequest request, CancellationToken ct)
    {
        try { return Ok(await service.RenameAsync(request, ct)); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("password"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        try { return Ok(await service.ChangePasswordAsync(HttpContext, request, ct)); }
        catch (AccountAuthenticationException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("switch/{accountId:guid}"), EnableRateLimiting("account")]
    public async Task<ActionResult<CurrentAccountDto>> Switch(Guid accountId, CancellationToken ct)
    {
        try { return (await service.SwitchAsync(HttpContext, accountId, ct)) is { } account ? Ok(account) : NotFound(); }
        catch (AccountConflictException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpDelete("device"), EnableRateLimiting("account")]
    public async Task<IActionResult> RemoveFromDevice(CancellationToken ct)
    {
        try { await service.RemoveFromDeviceAsync(HttpContext, ct); return NoContent(); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }

    [HttpDelete("current"), EnableRateLimiting("account")]
    public async Task<IActionResult> Delete(ConfirmAccountDeletionRequest request, CancellationToken ct)
    {
        try { await service.DeleteCurrentAsync(HttpContext, request, ct); return NoContent(); }
        catch (AccountAuthenticationException ex) { return Unauthorized(new { message = ex.Message }); }
        catch (AccountConflictException ex) { return Conflict(new { message = ex.Message }); }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { message = ex.Message }); }
    }
}
