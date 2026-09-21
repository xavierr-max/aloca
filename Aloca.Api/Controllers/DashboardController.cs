using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/dashboard"), Authorize]
public sealed class DashboardController(FinancialProjectionService service) : ControllerBase
{
    [HttpGet("projecao")]
    public async Task<ActionResult<FinancialProjectionResponse>> Projection([FromQuery] int meses = 12, [FromQuery] DateOnly? mesInicial = null, CancellationToken ct = default) =>
        Ok(await service.GetAsync(meses, mesInicial, ct));
}
