using System.ComponentModel.DataAnnotations;
using Aloca.Api.Models;

namespace Aloca.Api.DTOs;

public sealed record FinancialCommitmentCreateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int? TotalInstallments,
    [param: Range(1, int.MaxValue)] int? Priority,
    bool? IsFullyCommitted = null,
    Guid? CategoryId = null,
    DateOnly? DueDate = null,
    [param: StringLength(500)] string? Objective = null,
    bool Urgent = false,
    bool AutomaticProcessing = false,
    RecurringIncomeFrequency? Frequency = null,
    DateOnly? EndDate = null);

public sealed record FinancialCommitmentUpdateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int? TotalInstallments,
    [param: Range(1, int.MaxValue)] int? Priority,
    bool? IsFullyCommitted = null,
    Guid? CategoryId = null,
    DateOnly? DueDate = null,
    [param: StringLength(500)] string? Objective = null,
    bool Urgent = false,
    bool AutomaticProcessing = false,
    RecurringIncomeFrequency? Frequency = null,
    DateOnly? EndDate = null);

public sealed record AmountRequest(
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal Amount);

public sealed record FinancialCommitmentResponse(
    Guid Id, string Name, decimal InstallmentAmount, int TotalInstallments, int PaidInstallments,
    int RemainingInstallments, decimal TotalAmount, decimal RemainingAmount, decimal AllocatedAmount,
    int CoveredInstallments, decimal MissingForNextInstallment, decimal MissingForFullCoverage,
    decimal ExcessAllocatedAmount, int? Priority, string? PriorityLabel, bool IsFullyCommitted, bool IsCompleted,
    Guid? CategoryId, string? CategoryName, DateOnly DueDate, DateOnly? NextDueDate, string? Objective, bool Urgent,
    decimal TotalPaidAmount, decimal TotalAllocatedAmount, decimal OverallRemainingAmount, decimal OverallCoveragePercentage,
    bool RequiresAttention, bool AutomaticProcessing, string? AutomaticProcessingWarning,
    RecurringIncomeFrequency Frequency = RecurringIncomeFrequency.Monthly, DateOnly? EndDate = null,
    bool IsRecurring = false, bool IsOpenEnded = false,
    decimal AllocatedForNextInstallment = 0m, decimal RemainingForNextInstallment = 0m,
    decimal CoveragePercentage = 0m, bool CanPay = false,
    decimal AvailableToAllocate = 0m, bool CanAllocate = false,
    IReadOnlyCollection<FinancialCommitmentOccurrenceResponse>? Occurrences = null)
{
    public string CoverageStatus => IsCompleted ? "full" : CoveragePercentage >= 100m ? "next" : CoveragePercentage <= 0m ? "none" : "partial";
}

public sealed record FinancialCommitmentOccurrenceResponse(
    Guid Id, DateOnly ScheduledDate, int InstallmentNumber, decimal Amount,
    FinancialCommitmentOccurrenceStatus Status, Guid? CommitmentPaymentId,
    DateTime? ProcessedAt);
