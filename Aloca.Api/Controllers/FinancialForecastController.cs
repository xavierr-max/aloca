using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController, Authorize]
[Route("api/financial-forecast")]
public sealed class FinancialForecastController(
    IFinancialForecastService service,
    IBusinessClock clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<FinancialForecastResponse>> Get(
        [FromQuery] DateOnly? from,
        [FromQuery] int? months,
        CancellationToken cancellationToken)
    {
        var period = months ?? 6;
        if (period is not (3 or 6 or 12))
            return BadRequest(new { message = "months deve ser 3, 6 ou 12." });

        var start = from ?? new DateOnly(clock.Today.Year, clock.Today.Month, 1);
        if (start.Day != 1)
            return BadRequest(new { message = "from deve representar o primeiro dia do mês." });

        return Ok(await service.GetAsync(start, period, cancellationToken));
    }
}
