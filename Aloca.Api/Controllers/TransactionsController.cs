using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Aloca.Api.Controllers;

[ApiController]
[Route("api/transactions")]
public sealed class TransactionsController(TransactionService transactionService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<PagedResponse<TransactionResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResponse<TransactionResponse>>> GetAll(
        [FromQuery] TransactionQueryParameters queryParameters,
        CancellationToken cancellationToken)
    {
        if (queryParameters.StartDate > queryParameters.EndDate)
        {
            return BadRequest(new { message = "StartDate cannot be after EndDate." });
        }

        return Ok(await transactionService.GetAllAsync(queryParameters, cancellationToken));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await transactionService.GetByIdAsync(id, cancellationToken);
        return transaction is null ? NotFound() : Ok(transaction);
    }

    [HttpPost]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> Create(TransactionRequest request, CancellationToken cancellationToken)
    {
        var result = await transactionService.CreateAsync(request, cancellationToken);
        if (result.Status == TransactionWriteStatus.CategoryNotFound)
        {
            return NotFound(new { message = "Category was not found." });
        }

        var response = await transactionService.GetByIdAsync(result.Transaction!.Id, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Transaction.Id }, response);
    }

    [HttpPut("{id:guid}")]
    [ProducesResponseType<TransactionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransactionResponse>> Update(Guid id, TransactionRequest request, CancellationToken cancellationToken)
    {
        var result = await transactionService.UpdateAsync(id, request, cancellationToken);
        if (result.Status == TransactionWriteStatus.NotFound)
        {
            return NotFound();
        }

        if (result.Status == TransactionWriteStatus.CategoryNotFound)
        {
            return NotFound(new { message = "Category was not found." });
        }

        return Ok(await transactionService.GetByIdAsync(id, cancellationToken));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await transactionService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();
}
