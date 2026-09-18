using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/financial-settings")]
public sealed class FinancialSettingsController(FinancialSettingsService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FinancialSettingsResponse>> Get(CancellationToken ct) => Ok(await service.GetAsync(ct));

    [HttpPut]
    public async Task<ActionResult<FinancialSettingsResponse>> Update(FinancialSettingsRequest request, CancellationToken ct)
    {
        try { return Ok(await service.UpdateAsync(request.InitialBalance, ct)); }
        catch (ArgumentOutOfRangeException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
