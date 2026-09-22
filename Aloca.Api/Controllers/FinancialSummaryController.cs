using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Authorize]
[Route("api/financial-summary")]
public sealed class FinancialSummaryController(FinancialSummaryService financialSummaryService, IBusinessClock clock) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<FinancialSummaryResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FinancialSummaryResponse>> Get(CancellationToken cancellationToken) =>
        Ok(await financialSummaryService.GetAsync(cancellationToken));

    [HttpGet("monthly")]
    public async Task<ActionResult<MonthlyFinancialSummaryResponse>> Monthly([FromQuery] DateOnly? period, CancellationToken cancellationToken) =>
        Ok(await financialSummaryService.GetMonthlyAsync(period ?? new DateOnly(clock.Today.Year, clock.Today.Month, 1), cancellationToken));
}
