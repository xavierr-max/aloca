using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/allocations")]
public sealed class FinancialAllocationsController(FinancialAllocationService service) : ControllerBase
{
    [HttpGet("preview")]
    public async Task<ActionResult<AllocationPreviewResponse>> Preview(CancellationToken ct) => Ok(await service.PreviewAsync(ct));

    [HttpPost("distribute")]
    public async Task<ActionResult<AllocationDistributionResponse>> Distribute(CancellationToken ct) => Ok(await service.DistributeAsync(ct));
}
