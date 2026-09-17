using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController]
[Route("api/financial-summary")]
public sealed class FinancialSummaryController(FinancialSummaryService financialSummaryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<FinancialSummaryResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<FinancialSummaryResponse>> Get(CancellationToken cancellationToken) =>
        Ok(await financialSummaryService.GetAsync(cancellationToken));
}
