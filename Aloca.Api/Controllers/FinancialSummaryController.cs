using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Authorize]
[Route("api/financial-summary")]
public sealed class FinancialSummaryController(FinancialSummaryService financialSummaryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<FinancialSummaryResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FinancialSummaryResponse>> Get(CancellationToken cancellationToken) =>
        Ok(await financialSummaryService.GetAsync(cancellationToken));

    [HttpGet("monthly")]
    public async Task<ActionResult<MonthlyFinancialSummaryResponse>> Monthly([FromQuery] DateOnly? period, CancellationToken cancellationToken) =>
        Ok(await financialSummaryService.GetMonthlyAsync(period ?? new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1), cancellationToken));
}
