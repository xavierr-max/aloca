using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public sealed class FinancialSummaryService(AlocaDbContext dbContext)
{
    public async Task<FinancialSummaryResponse> GetAsync(CancellationToken cancellationToken)
    {
        var totalIncome = await dbContext.Transactions
            .Where(transaction => transaction.Type == TransactionType.Income)
            .SumAsync(transaction => (decimal?)transaction.Amount, cancellationToken) ?? 0m;

        var totalExpense = await dbContext.Transactions
            .Where(transaction => transaction.Type == TransactionType.Expense)
            .SumAsync(transaction => (decimal?)transaction.Amount, cancellationToken) ?? 0m;

        return new FinancialSummaryResponse(totalIncome, totalExpense, totalIncome - totalExpense);
    }
}
