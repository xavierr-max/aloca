using Aloca.Api.Models;

namespace Aloca.Api.Tests;

public sealed class FinancialCommitmentTests
{
    [Fact]
    public void CalculatesCoverage_WhenThereIsNoAllocatedAmount()
    {
        var commitment = CreateCommitment(allocatedAmount: 0m);

        Assert.Equal(3, commitment.RemainingInstallments);
        Assert.Equal(0, commitment.CoveredInstallments);
        Assert.Equal(569.70m, commitment.RemainingAmount);
        Assert.Equal(189.90m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(569.70m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void UrgentCommitmentRequiresAttentionFromOverallCoverage()
    {
        var commitment = CreateCommitment(allocatedAmount: 189.90m, urgent: true);

        Assert.Equal(33.3m, Math.Round(commitment.OverallCoveragePercentage, 1));
        Assert.Equal(379.80m, commitment.OverallRemainingAmount);
        Assert.True(commitment.RequiresAttention);
    }

    [Fact]
    public void UrgentCommitmentWithNoCoverageRequiresAttention()
    {
        var commitment = CreateCommitment(urgent: true);

        Assert.Equal(0m, commitment.OverallCoveragePercentage);
        Assert.Equal(commitment.TotalAmount, commitment.OverallRemainingAmount);
        Assert.True(commitment.RequiresAttention);
    }

    [Fact]
    public void NonUrgentPartialCommitmentDoesNotUseCriticalUrgentAttention()
    {
        var commitment = CreateCommitment(allocatedAmount: 189.90m);

        Assert.Equal(33.3m, Math.Round(commitment.OverallCoveragePercentage, 1));
        Assert.False(commitment.RequiresAttention);
    }

    [Fact]
    public void UrgentCommitmentStopsRequiringAttentionOnlyAtFullOverallCoverage()
    {
        var commitment = CreateCommitment(allocatedAmount: 189.90m, urgent: true);
        commitment.Allocate(379.80m);

        Assert.Equal(100m, commitment.OverallCoveragePercentage);
        Assert.Equal(0m, commitment.OverallRemainingAmount);
        Assert.False(commitment.RequiresAttention);
    }

    [Fact]
    public void CalculatesCoverage_WhenOneHundredIsAllocated()
    {
        var commitment = CreateCommitment(allocatedAmount: 100m);

        Assert.Equal(0, commitment.CoveredInstallments);
        Assert.Equal(89.90m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(469.70m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void CalculatesCoverage_WhenOneInstallmentIsAllocated()
    {
        var commitment = CreateCommitment(allocatedAmount: 189.90m);

        Assert.Equal(1, commitment.CoveredInstallments);
        Assert.Equal(0m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(379.80m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void CalculatesCoverage_WhenFourHundredIsAllocated()
    {
        var commitment = CreateCommitment(allocatedAmount: 400m);

        Assert.Equal(2, commitment.CoveredInstallments);
        Assert.Equal(0m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(169.70m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void CalculatesCoverage_WhenAllInstallmentsAreAllocated()
    {
        var commitment = CreateCommitment(allocatedAmount: 569.70m);

        Assert.Equal(3, commitment.CoveredInstallments);
        Assert.Equal(0m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(0m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void CalculatesCoverage_UsingOnlyUnpaidInstallments()
    {
        var commitment = CreateCommitment(allocatedAmount: 250m, paidInstallments: 1);

        Assert.Equal(2, commitment.RemainingInstallments);
        Assert.Equal(1, commitment.CoveredInstallments);
        Assert.Equal(379.80m, commitment.RemainingAmount);
        Assert.Equal(0m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(129.80m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void LimitsCoveredInstallmentsAndShortfalls_WhenAllocationExceedsRemainingAmount()
    {
        var commitment = CreateCommitment(allocatedAmount: 1_000m, paidInstallments: 1);

        Assert.Equal(2, commitment.CoveredInstallments);
        Assert.Equal(0m, commitment.AmountNeededForNextInstallment);
        Assert.Equal(0m, commitment.AmountNeededForFullCoverage);
    }

    [Fact]
    public void RejectsInvalidValues()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(installmentAmount: 0m));
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(totalInstallments: 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(paidInstallments: -1));
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(totalInstallments: 2, paidInstallments: 3));
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(allocatedAmount: -0.01m));
        Assert.Throws<ArgumentOutOfRangeException>(() => CreateCommitment(priority: 0));
    }

    [Fact]
    public void AllowsCommitmentWithoutPriority()
    {
        var commitment = CreateCommitment(priority: null);

        Assert.Null(commitment.Priority);
    }

    [Fact]
    public void AllowsRemovingPriorityWhenUpdating()
    {
        var commitment = CreateCommitment(priority: 1);

        commitment.UpdateDetails(commitment.Name, commitment.InstallmentAmount, commitment.TotalInstallments,
            null, commitment.IsFullyCommitted, commitment.CategoryId);

        Assert.Null(commitment.Priority);
    }

    [Fact]
    public void DoesNotAllowChangingTheFirstDueDateAfterPayment()
    {
        var commitment = CreateCommitment();
        commitment.RegisterPayment();

        Assert.Throws<InvalidOperationException>(() => commitment.UpdateDetails(
            commitment.Name, commitment.InstallmentAmount, commitment.TotalInstallments,
            commitment.Priority, commitment.IsFullyCommitted, commitment.CategoryId,
            new DateOnly(2026, 10, 18)));
    }

    [Fact]
    public void RegisterPaymentConsumesAllocatedInstallmentAmount()
    {
        var commitment = CreateCommitment(allocatedAmount: 400m);

        commitment.RegisterPayment();

        Assert.Equal(1, commitment.PaidInstallments);
        Assert.Equal(210.10m, commitment.AllocatedAmount);
        Assert.Equal(2, commitment.RemainingInstallments);
        Assert.Equal(379.80m, commitment.RemainingAmount);
    }

    [Fact]
    public void RegisterPaymentNeverMakesAllocationNegative()
    {
        var commitment = CreateCommitment(allocatedAmount: 10m);

        commitment.RegisterPayment();

        Assert.Equal(0m, commitment.AllocatedAmount);
    }

    [Fact]
    public void RejectsPaymentBeyondTotalInstallments()
    {
        var commitment = CreateCommitment(totalInstallments: 1);
        commitment.RegisterPayment();

        Assert.Throws<InvalidOperationException>(() => commitment.RegisterPayment());
    }

    [Fact]
    public void AllocationAndDeallocationAreValidated()
    {
        var commitment = CreateCommitment();
        commitment.Allocate(100m);
        commitment.Allocate(50m);
        commitment.Deallocate(50m);

        Assert.Equal(100m, commitment.AllocatedAmount);
        Assert.Throws<ArgumentOutOfRangeException>(() => commitment.Allocate(0m));
        Assert.Throws<InvalidOperationException>(() => commitment.Deallocate(101m));
    }

    [Fact]
    public void ReleasingAllAllocationLeavesPaidInstallmentsAndCommitmentIntact()
    {
        var commitment = CreateCommitment(allocatedAmount: 400m);
        commitment.RegisterPayment();

        var released = commitment.ReleaseAllAllocation();

        Assert.Equal(210.10m, released);
        Assert.Equal(0m, commitment.AllocatedAmount);
        Assert.Equal(1, commitment.PaidInstallments);
        Assert.Equal(2, commitment.RemainingInstallments);
        Assert.False(commitment.IsCompleted);
        Assert.Equal(33.3m, Math.Round(commitment.OverallCoveragePercentage, 1));
    }

    [Fact]
    public void ReleasingWithoutAllocationIsAValidNoOp()
    {
        var commitment = CreateCommitment();

        Assert.Equal(0m, commitment.ReleaseAllAllocation());
        Assert.Equal(0m, commitment.AllocatedAmount);
    }

    private static FinancialCommitment CreateCommitment(
        decimal installmentAmount = 189.90m,
        int totalInstallments = 3,
        int paidInstallments = 0,
        decimal allocatedAmount = 0m,
        int? priority = 1,
        bool urgent = false) =>
        new(
            "Notebook",
            installmentAmount,
            totalInstallments,
            paidInstallments,
            allocatedAmount,
            priority,
            isFullyCommitted: true,
            urgent: urgent);
}
