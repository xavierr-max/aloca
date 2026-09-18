using Aloca.Api.DTOs;
using Aloca.Api.Data;
using Microsoft.Extensions.DependencyInjection;

namespace Aloca.Api.Services;

public sealed class FinancialSummaryService
{
    private readonly FinancialBalanceService balanceService;

    [ActivatorUtilitiesConstructor]
    public FinancialSummaryService(FinancialBalanceService balanceService) => this.balanceService = balanceService;

    public FinancialSummaryService(AlocaDbContext dbContext) : this(new FinancialBalanceService(dbContext)) { }

    public async Task<FinancialSummaryResponse> GetAsync(CancellationToken cancellationToken)
    {
        var x = await balanceService.GetAsync(cancellationToken);
        return new(x.InitialBalance, x.TotalIncome, x.TotalExpense, x.Balance, x.AllocatedAmount, x.UnallocatedBalance, x.FreeBalance, x.AllocationDeficit);
    }
}
