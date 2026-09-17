using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed record FinancialCommitmentCreateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int TotalInstallments,
    [param: Range(1, int.MaxValue)] int Priority,
    bool IsFullyCommitted,
    Guid? CategoryId = null);

public sealed record FinancialCommitmentUpdateRequest(
    [param: Required, StringLength(150, MinimumLength = 1)] string Name,
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal InstallmentAmount,
    [param: Range(1, int.MaxValue)] int TotalInstallments,
    [param: Range(1, int.MaxValue)] int Priority,
    bool IsFullyCommitted,
    Guid? CategoryId = null);

public sealed record AmountRequest(
    [param: Range(typeof(decimal), "0.01", "9999999999999999.99")] decimal Amount);

public sealed record FinancialCommitmentResponse(
    Guid Id, string Name, decimal InstallmentAmount, int TotalInstallments, int PaidInstallments,
    int RemainingInstallments, decimal TotalAmount, decimal RemainingAmount, decimal AllocatedAmount,
    int CoveredInstallments, decimal MissingForNextInstallment, decimal MissingForFullCoverage,
    decimal ExcessAllocatedAmount, int Priority, string PriorityLabel, bool IsFullyCommitted, bool IsCompleted,
    Guid? CategoryId, string? CategoryName);
