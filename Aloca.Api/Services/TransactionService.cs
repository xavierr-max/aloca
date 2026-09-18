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

        if (!string.IsNullOrWhiteSpace(queryParameters.Search))
        {
            var search = queryParameters.Search.Trim().ToLower();
            query = query.Where(transaction => transaction.Description.ToLower().Contains(search));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        query = queryParameters.Sort.ToLowerInvariant() switch
        {
            "amount" => queryParameters.Descending ? query.OrderByDescending(x => x.Amount) : query.OrderBy(x => x.Amount),
            _ => queryParameters.Descending ? query.OrderByDescending(x => x.Date).ThenByDescending(x => x.Id) : query.OrderBy(x => x.Date).ThenBy(x => x.Id)
        };
        var items = await query
            .Skip((queryParameters.Page - 1) * queryParameters.PageSize)
            .Take(queryParameters.PageSize)
            .Select(transaction => new TransactionResponse(
                transaction.Id,
                transaction.Description,
                transaction.Amount,
                transaction.Type,
                transaction.Date,
                transaction.CategoryId,
                transaction.Category == null ? null : transaction.Category.Name,
                transaction.CreatedAt,
                transaction.RecurringIncomeOccurrenceId != null))
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
                transaction.Category == null ? null : transaction.Category.Name,
                transaction.CreatedAt,
                transaction.RecurringIncomeOccurrenceId != null))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<TransactionWriteResult> CreateAsync(TransactionRequest request, CancellationToken cancellationToken)
    {
        var categoryExists = !request.CategoryId.HasValue || await dbContext.Categories
            .AnyAsync(category => category.Id == request.CategoryId.Value, cancellationToken);

        if (request.Type == TransactionType.Income && !request.CategoryId.HasValue)
            return new TransactionWriteResult(TransactionWriteStatus.CategoryNotFound, null);

        if (!categoryExists)
        {
            return new TransactionWriteResult(TransactionWriteStatus.CategoryNotFound, null);
        }

        var transaction = new Transaction(request.Description, request.Amount, request.Type, request.Date, request.CategoryId);
        dbContext.Transactions.Add(transaction);
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

        if (transaction.RecurringIncomeOccurrenceId is { } occurrenceId)
        {
            var occurrence = await dbContext.RecurringIncomeOccurrences
                .SingleOrDefaultAsync(x => x.Id == occurrenceId, cancellationToken);
            occurrence?.RestoreAfterTransactionDeletion();
        }

        dbContext.Transactions.Remove(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<TransactionWriteResult> UpdateAsync(Guid id, TransactionRequest request, CancellationToken cancellationToken)
    {
        var transaction = await dbContext.Transactions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (transaction is null) return new(TransactionWriteStatus.NotFound, null);
        if (request.Type != transaction.Type) return new(TransactionWriteStatus.CategoryNotFound, null);
        var categoryExists = !request.CategoryId.HasValue || await dbContext.Categories.AnyAsync(x => x.Id == request.CategoryId.Value, cancellationToken);
        if (!categoryExists || (request.Type == TransactionType.Income && !request.CategoryId.HasValue)) return new(TransactionWriteStatus.CategoryNotFound, null);
        transaction.UpdateDetails(request.Description, request.Amount, request.Date, request.CategoryId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new(TransactionWriteStatus.Success, transaction);
    }
}
