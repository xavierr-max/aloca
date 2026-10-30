using System.ComponentModel.DataAnnotations;
using Aloca.Api.Models;

namespace Aloca.Api.DTOs;

public sealed record FinancialCommitmentCreateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int? TotalInstallments,
    [param: Range(1, int.MaxValue)] int? Priority,
    Guid? CategoryId = null, DateOnly? DueDate = null, [param: StringLength(500)] string? Objective = null,
    bool Urgent = false, bool AutomaticProcessing = false, RecurringIncomeFrequency? Frequency = null, DateOnly? EndDate = null);

public sealed record FinancialCommitmentUpdateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int? TotalInstallments,
    [param: Range(1, int.MaxValue)] int? Priority,
    Guid? CategoryId = null, DateOnly? DueDate = null, [param: StringLength(500)] string? Objective = null,
    bool Urgent = false, bool AutomaticProcessing = false, RecurringIncomeFrequency? Frequency = null, DateOnly? EndDate = null);

public sealed record PaymentRequest(bool ConfirmInsufficientBalance = false);

public sealed record FinancialCommitmentResponse(
    Guid Id, string Name, decimal InstallmentAmount, int TotalInstallments, int PaidInstallments,
    int RemainingInstallments, decimal TotalAmount, decimal RemainingAmount, decimal TotalPaidAmount,
    decimal RemainingTotalAmount, int? Priority, string? PriorityLabel, bool IsCompleted,
    Guid? CategoryId, string? CategoryName, DateOnly DueDate, DateOnly? NextDueDate, string? Objective, bool Urgent,
    bool RequiresAttention, bool AutomaticProcessing, string? AutomaticProcessingWarning,
    RecurringIncomeFrequency Frequency = RecurringIncomeFrequency.Monthly, DateOnly? EndDate = null,
    bool IsRecurring = false, bool IsOpenEnded = false,
    bool CanPay = false, IReadOnlyCollection<FinancialCommitmentOccurrenceResponse>? Occurrences = null);

public sealed record FinancialCommitmentOccurrenceResponse(Guid Id, DateOnly ScheduledDate, int InstallmentNumber, decimal Amount,
    FinancialCommitmentOccurrenceStatus Status, Guid? CommitmentPaymentId, DateTime? ProcessedAt);
