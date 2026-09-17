namespace Aloca.Api.DTOs;

public sealed record AllocationChangeResponse(Guid FinancialCommitmentId, string Name, decimal Amount);

public sealed record AllocationPreviewResponse(
    decimal AvailableBalance,
    decimal WouldAllocate,
    decimal RemainingFreeBalance,
    IReadOnlyCollection<AllocationChangeResponse> Allocations);

public sealed record AllocationDistributionResponse(
    decimal BalanceBefore,
    decimal AllocatedBefore,
    decimal NewlyAllocated,
    decimal AllocatedAfter,
    decimal FreeBalanceAfter,
    IReadOnlyCollection<AllocationChangeResponse> Allocations);
