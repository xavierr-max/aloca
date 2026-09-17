using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/financial-commitments")]
public sealed class FinancialCommitmentsController(FinancialCommitmentService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<FinancialCommitmentResponse>>> GetAll([FromQuery] bool? isCompleted, [FromQuery] bool? isFullyCommitted, CancellationToken ct) => Ok(await service.GetAllAsync(isCompleted, isFullyCommitted, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<FinancialCommitmentResponse>> GetById(Guid id, CancellationToken ct) => (await service.GetByIdAsync(id, ct)) is { } item ? Ok(item) : NotFound();

    [HttpPost]
    public async Task<ActionResult<FinancialCommitmentResponse>> Create(FinancialCommitmentCreateRequest request, CancellationToken ct)
    {
        try
        {
            var item = await service.CreateAsync(request, ct);
            return CreatedAtAction(nameof(GetById), new { id = item.Id }, await service.GetByIdAsync(item.Id, ct));
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FinancialCommitmentResponse>> Update(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        try { var item = await service.UpdateAsync(id, request, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) => await service.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:guid}/allocations")]
    public async Task<ActionResult<FinancialCommitmentResponse>> Allocate(Guid id, AmountRequest request, CancellationToken ct)
    {
        try { var item = await service.AllocateAsync(id, request.Amount, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/deallocations")]
    public Task<ActionResult<FinancialCommitmentResponse>> Deallocate(Guid id, AmountRequest request, CancellationToken ct) => Mutate(id, x => x.Deallocate(request.Amount), ct);

    [HttpPost("{id:guid}/payments")]
    public Task<ActionResult<FinancialCommitmentResponse>> Payment(Guid id, CancellationToken ct) => Mutate(id, x => x.RegisterPayment(), ct);

    [HttpDelete("{id:guid}/payments/latest")]
    public Task<ActionResult<FinancialCommitmentResponse>> ReversePayment(Guid id, CancellationToken ct) => Mutate(id, x => x.ReverseLatestPayment(), ct);

    private async Task<ActionResult<FinancialCommitmentResponse>> Mutate(Guid id, Action<Aloca.Api.Models.FinancialCommitment> mutation, CancellationToken ct)
    {
        try { var item = await service.MutateAsync(id, mutation, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
