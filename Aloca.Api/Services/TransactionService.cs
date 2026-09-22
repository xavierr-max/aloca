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

public sealed class TransactionService(AlocaDbContext dbContext, FinancialAllocationReconciliationService? reconciliation = null, ILogger<TransactionService>? logger = null)
{
    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 100;
    private FinancialAllocationReconciliationService Reconciliation => reconciliation ??= new(dbContext, new FinancialBalanceService(dbContext));
    public async Task<PagedResponse<TransactionResponse>> GetAllAsync(
        TransactionQueryParameters queryParameters,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, queryParameters.Page);
        var pageSize = Math.Clamp(queryParameters.PageSize <= 0 ? DefaultPageSize : queryParameters.PageSize, 1, MaxPageSize);
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
            "amount" => queryParameters.Descending
                ? query.OrderByDescending(x => x.Amount).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
                : query.OrderBy(x => x.Amount).ThenBy(x => x.CreatedAt).ThenBy(x => x.Id),
            _ => queryParameters.Descending
                ? query.OrderByDescending(x => x.Date).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
                : query.OrderBy(x => x.Date).ThenBy(x => x.CreatedAt).ThenBy(x => x.Id)
        };
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(transaction => new TransactionResponse(
                transaction.Id,
                transaction.Description,
                transaction.Amount,
                transaction.Type,
                transaction.Date,
                transaction.CategoryId,
                transaction.Category == null ? null : transaction.Category.Name,
                transaction.CreatedAt,
                transaction.RecurringIncomeOccurrenceId != null,
                transaction.FinancialCommitmentId,
                transaction.WasAutomatic))
            .ToListAsync(cancellationToken);

        return new PagedResponse<TransactionResponse>(items, page, pageSize, totalCount);
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
                transaction.RecurringIncomeOccurrenceId != null,
                transaction.FinancialCommitmentId,
                transaction.WasAutomatic))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<TransactionWriteResult> CreateAsync(TransactionRequest request, CancellationToken cancellationToken)
    {
        await using var dbTransaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken) : null;
        var categoryExists = !request.CategoryId.HasValue || await dbContext.Categories
            .AnyAsync(category => category.Id == request.CategoryId.Value, cancellationToken);


        if (!categoryExists)
        {
            return new TransactionWriteResult(TransactionWriteStatus.CategoryNotFound, null);
        }

        var transaction = new Transaction(request.Description, request.Amount, request.Type, request.Date, request.CategoryId);
        dbContext.Transactions.Add(transaction);
        await dbContext.SaveChangesAsync(cancellationToken);
        await Reconciliation.ReconcileAsync(cancellationToken);
        if (dbTransaction is not null) await dbTransaction.CommitAsync(cancellationToken);
        logger?.LogInformation("Transaction created transaction_id={TransactionId} type={TransactionType}", transaction.Id, transaction.Type);
        return new TransactionWriteResult(TransactionWriteStatus.Success, transaction);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var dbTransaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken) : null;
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
        await Reconciliation.ReconcileAsync(cancellationToken);
        if (dbTransaction is not null) await dbTransaction.CommitAsync(cancellationToken);
        logger?.LogInformation("Transaction deleted transaction_id={TransactionId}", id);
        return true;
    }

    public async Task<TransactionWriteResult> UpdateAsync(Guid id, TransactionRequest request, CancellationToken cancellationToken)
    {
        await using var dbTransaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, cancellationToken) : null;
        var transaction = await dbContext.Transactions.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (transaction is null) return new(TransactionWriteStatus.NotFound, null);
        if (request.Type != transaction.Type) return new(TransactionWriteStatus.CategoryNotFound, null);
        var categoryExists = !request.CategoryId.HasValue || await dbContext.Categories.AnyAsync(x => x.Id == request.CategoryId.Value, cancellationToken);
        if (!categoryExists) return new(TransactionWriteStatus.CategoryNotFound, null);
        transaction.UpdateDetails(request.Description, request.Amount, request.Date, request.CategoryId);
        await dbContext.SaveChangesAsync(cancellationToken);
        await Reconciliation.ReconcileAsync(cancellationToken);
        if (dbTransaction is not null) await dbTransaction.CommitAsync(cancellationToken);
        logger?.LogInformation("Transaction changed transaction_id={TransactionId} type={TransactionType}", transaction.Id, transaction.Type);
        return new(TransactionWriteStatus.Success, transaction);
    }
}
