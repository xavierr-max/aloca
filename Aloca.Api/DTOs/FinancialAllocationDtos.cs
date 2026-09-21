namespace Aloca.Api.DTOs;

public sealed record AllocationChangeResponse(Guid FinancialCommitmentId, string Name, decimal Amount);

public sealed record AllocationPreviewResponse(
    decimal UnallocatedBalance,
    decimal WouldAllocate,
    decimal RemainingUnallocatedBalance,
    IReadOnlyCollection<AllocationChangeResponse> Allocations);

public sealed record AllocationDistributionResponse(
    decimal BalanceBefore,
    decimal AllocatedBefore,
    decimal NewlyAllocated,
    decimal AllocatedAfter,
    decimal FreeBalanceAfter,
    decimal CoverageDeficitAfter,
    IReadOnlyCollection<AllocationChangeResponse> Allocations);
