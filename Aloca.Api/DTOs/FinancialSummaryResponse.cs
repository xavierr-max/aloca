namespace Aloca.Api.DTOs;

public sealed record FinancialSummaryResponse(
    decimal InitialBalance,
    decimal TotalIncome,
    decimal TotalExpense,
    decimal Balance,
    decimal AllocatedAmount,
    decimal FreeBalance,
    decimal AllocationDeficit);
