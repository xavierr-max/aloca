using Aloca.Api.DTOs;

namespace Aloca.Api.Services;

public sealed class FinancialSummaryService(FinancialBalanceService balanceService)
{
    public async Task<FinancialSummaryResponse> GetAsync(CancellationToken cancellationToken)
    {
        var x = await balanceService.GetAsync(cancellationToken);
        return new(x.InitialBalance, x.TotalIncome, x.TotalExpense, x.Balance, x.AllocatedAmount, x.FreeBalance, x.AllocationDeficit);
    }
}
