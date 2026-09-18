using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/recurring-incomes")]
public sealed class RecurringIncomesController(RecurringIncomeService service) : ControllerBase
{
    [HttpGet] public async Task<ActionResult<IReadOnlyCollection<RecurringIncomeResponse>>> GetAll(CancellationToken ct) => Ok(await service.GetAllAsync(ct));
    [HttpGet("projection")] public async Task<ActionResult<IReadOnlyCollection<ProjectionMonthResponse>>> Projection(CancellationToken ct) => Ok(await service.ProjectionAsync(ct));
    [HttpGet("{id:guid}")] public async Task<ActionResult<RecurringIncomeResponse>> Get(Guid id, CancellationToken ct) { var x = await service.GetAsync(id, ct); return x is null ? NotFound() : Ok(x); }
    [HttpPost] public async Task<ActionResult<RecurringIncomeResponse>> Create(RecurringIncomeRequest request, CancellationToken ct) { var x = await service.CreateAsync(request, ct); return x is null ? NotFound(new { message = "Category was not found." }) : Ok(x); }
    [HttpPut("{id:guid}")] public async Task<ActionResult<RecurringIncomeResponse>> Update(Guid id, RecurringIncomeRequest request, CancellationToken ct) { var x = await service.UpdateAsync(id, request, ct); return x is null ? NotFound() : Ok(x); }
    [HttpPost("{id:guid}/pause")] public async Task<IActionResult> Pause(Guid id, CancellationToken ct) => await service.SetActiveAsync(id, false, ct) ? NoContent() : NotFound();
    [HttpPost("{id:guid}/activate")] public async Task<IActionResult> Activate(Guid id, CancellationToken ct) => await service.SetActiveAsync(id, true, ct) ? NoContent() : NotFound();
    [HttpDelete("{id:guid}")] public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try
        {
            return await service.DeleteAsync(id, ct) ? NoContent() : NotFound(new { message = "A entrada recorrente não foi encontrada." });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Não foi possível excluir a entrada recorrente porque existem dados relacionados." });
        }
    }
    [HttpPost("occurrences/{occurrenceId:guid}/receive")] public async Task<ActionResult<RecurringIncomeOccurrenceResponse>> Receive(Guid occurrenceId, CancellationToken ct) { var x = await service.ReceiveAsync(occurrenceId, ct); return x is null ? NotFound() : Ok(x); }
}
