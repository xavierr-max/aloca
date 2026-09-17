using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public enum TransactionWriteStatus
{
    Success,
    NotFound,
    CategoryNotFound
}

public sealed record TransactionWriteResult(TransactionWriteStatus Status, Transaction? Transaction);

public sealed class TransactionService(AlocaDbContext dbContext)
{
    public async Task<PagedResponse<TransactionResponse>> GetAllAsync(
        TransactionQueryParameters queryParameters,
        CancellationToken cancellationToken)
    {
        var query = dbContext.Transactions.AsNoTracking().AsQueryable();

        if (queryParameters.Type.HasValue)
        {
            query = query.Where(transaction => transaction.Type == queryParameters.Type.Value);
        }

        if (queryParameters.CategoryId.HasValue)
        {
            query = query.Where(transaction => transaction.CategoryId == queryParameters.CategoryId.Value);
        }

        if (queryParameters.StartDate.HasValue)
        {
            query = query.Where(transaction => transaction.Date >= queryParameters.StartDate.Value);
        }

        if (queryParameters.EndDate.HasValue)
        {
            query = query.Where(transaction => transaction.Date <= queryParameters.EndDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(transaction => transaction.Date)
            .ThenByDescending(transaction => transaction.Id)
            .Skip((queryParameters.Page - 1) * queryParameters.PageSize)
            .Take(queryParameters.PageSize)
            .Select(transaction => new TransactionResponse(
                transaction.Id,
                transaction.Description,
                transaction.Amount,
                transaction.Type,
                transaction.Date,
                transaction.CategoryId,
                transaction.Category.Name))
            .ToListAsync(cancellationToken);

        return new PagedResponse<TransactionResponse>(items, queryParameters.Page, queryParameters.PageSize, totalCount);
    }

    public Task<TransactionResponse?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Transactions
            .AsNoTracking()
            .Where(transaction => transaction.Id == id)
            .Select(transaction => new TransactionResponse(
                transaction.Id,
                transaction.Description,
                transaction.Amount,
                transaction.Type,
                transaction.Date,
                transaction.CategoryId,
                transaction.Category.Name))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<TransactionWriteResult> CreateAsync(TransactionRequest request, CancellationToken cancellationToken)
    {
        var categoryExists = await dbContext.Categories
            .AnyAsync(category => category.Id == request.CategoryId, cancellationToken);

        if (!categoryExists)
        {
            return new TransactionWriteResult(TransactionWriteStatus.CategoryNotFound, null);
        }

        var transaction = new Transaction(request.Description, request.Amount, request.Type, request.Date, request.CategoryId);
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new TransactionWriteResult(TransactionWriteStatus.Success, transaction);
    }

    public async Task<TransactionWriteResult> UpdateAsync(Guid id, TransactionRequest request, CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Transactions
            .SingleOrDefaultAsync(transaction => transaction.Id == id, cancellationToken);

        if (transaction is null)
        {
            return new TransactionWriteResult(TransactionWriteStatus.NotFound, null);
        }

        var categoryExists = await dbContext.Categories
            .AnyAsync(category => category.Id == request.CategoryId, cancellationToken);

        if (!categoryExists)
        {
            return new TransactionWriteResult(TransactionWriteStatus.CategoryNotFound, null);
        }

        transaction.Update(request.Description, request.Amount, request.Type, request.Date, request.CategoryId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new TransactionWriteResult(TransactionWriteStatus.Success, transaction);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Transactions
            .SingleOrDefaultAsync(transaction => transaction.Id == id, cancellationToken);

        if (transaction is null)
        {
            return false;
        }

        dbContext.Transactions.Remove(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }
}
