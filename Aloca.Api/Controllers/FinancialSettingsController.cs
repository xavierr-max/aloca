using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/financial-settings"), Authorize]
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

    [HttpPost("current-balance-adjustment")]
    public async Task<ActionResult<FinancialSummaryResponse>> AdjustCurrentBalance(
        CurrentBalanceAdjustmentRequest request, IBusinessClock clock, CancellationToken ct)
    {
        try
        {
            var balance = await service.AdjustCurrentBalanceAsync(request.NewBalance, clock, ct);
            return Ok(new FinancialSummaryResponse(balance.InitialBalance, balance.TotalIncome, balance.TotalExpense,
                balance.SaldoReal, balance.TotalReservado, balance.SaldoNaoAlocado, balance.SaldoLivre, balance.DeficitCobertura));
        }
        catch (ArgumentOutOfRangeException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
