using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Route("api/financial-commitments"), Authorize]
public sealed class FinancialCommitmentsController(FinancialCommitmentService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<FinancialCommitmentResponse>>> GetAll([FromQuery] bool? isCompleted, CancellationToken ct) => Ok(await service.GetAllAsync(isCompleted, ct));

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
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FinancialCommitmentResponse>> Update(Guid id, FinancialCommitmentUpdateRequest request, CancellationToken ct)
    {
        try { var item = await service.UpdateAsync(id, request, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        try { return await service.DeleteAsync(id, ct) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/payments")]
    public async Task<ActionResult<FinancialCommitmentResponse>> Payment(Guid id, PaymentRequest? request, CancellationToken ct)
    {
        try { var item = await service.RegisterPaymentAsync(id, ct, confirmInsufficientBalance: request?.ConfirmInsufficientBalance ?? false); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (InsufficientBalanceConfirmationRequiredException ex) { return UnprocessableEntity(new { code = "insufficient_balance_confirmation_required", currentBalance = ex.CurrentBalance, paymentAmount = ex.PaymentAmount, insufficientAmount = ex.InsufficientAmount, message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPost("{id:guid}/occurrences/{occurrenceId:guid}/payment")]
    public async Task<ActionResult<FinancialCommitmentResponse>> PayOccurrence(Guid id, Guid occurrenceId, PaymentRequest? request, CancellationToken ct)
    {
        try { var item = await service.RegisterPaymentAsync(id, ct, occurrenceId: occurrenceId, confirmInsufficientBalance: request?.ConfirmInsufficientBalance ?? false); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (InsufficientBalanceConfirmationRequiredException ex) { return UnprocessableEntity(new { code = "insufficient_balance_confirmation_required", currentBalance = ex.CurrentBalance, paymentAmount = ex.PaymentAmount, insufficientAmount = ex.InsufficientAmount, message = ex.Message }); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}/payments/latest")]
    public async Task<ActionResult<FinancialCommitmentResponse>> ReversePayment(Guid id, CancellationToken ct)
    {
        try { var item = await service.ReverseLatestPaymentAsync(id, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{id:guid}/occurrences/{occurrenceId:guid}/payment")]
    public async Task<ActionResult<FinancialCommitmentResponse>> ReverseOccurrencePayment(Guid id, Guid occurrenceId, CancellationToken ct)
    {
        try { var item = await service.ReverseLatestPaymentAsync(id, ct, occurrenceId); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    private async Task<ActionResult<FinancialCommitmentResponse>> Mutate(Guid id, Action<Aloca.Api.Models.FinancialCommitment> mutation, CancellationToken ct)
    {
        try { var item = await service.MutateAsync(id, mutation, ct); return item is null ? NotFound() : Ok(await service.GetByIdAsync(id, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

}
