namespace Aloca.Api.DTOs;

public sealed record FinancialSummaryResponse(decimal TotalIncome, decimal TotalExpense, decimal Balance);
