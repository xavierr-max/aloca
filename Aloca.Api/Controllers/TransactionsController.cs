using Aloca.Api.DTOs;
using Aloca.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace Aloca.Api.Controllers;

[ApiController, Authorize]
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

        if (queryParameters.StartDate.HasValue && queryParameters.EndDate.HasValue &&
            queryParameters.EndDate.Value > queryParameters.StartDate.Value.AddYears(10))
        {
            return BadRequest(new { message = "O período máximo para consultar movimentações é de 10 anos." });
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
            return BadRequest(new { message = request.Type == Aloca.Api.Models.TransactionType.Income ? "Entradas precisam de um grupo." : "Group was not found." });
        }

        var response = await transactionService.GetByIdAsync(result.Transaction!.Id, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = result.Transaction.Id }, response);
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        try { return await transactionService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TransactionResponse>> Update(Guid id, TransactionRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await transactionService.UpdateAsync(id, request, cancellationToken);
            if (result.Status == TransactionWriteStatus.NotFound) return NotFound();
            if (result.Status == TransactionWriteStatus.CategoryNotFound) return BadRequest(new { message = "Grupo inválido para esta movimentação." });
            return Ok(await transactionService.GetByIdAsync(id, cancellationToken));
        }
        catch (InvalidOperationException ex) { return Conflict(new { message = ex.Message }); }
    }
}
