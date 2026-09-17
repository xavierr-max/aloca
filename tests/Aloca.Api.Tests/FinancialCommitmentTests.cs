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

    private static FinancialCommitment CreateCommitment(
        decimal installmentAmount = 189.90m,
        int totalInstallments = 3,
        int paidInstallments = 0,
        decimal allocatedAmount = 0m,
        int priority = 1) =>
        new(
            "Notebook",
            installmentAmount,
            totalInstallments,
            paidInstallments,
            allocatedAmount,
            priority,
            isFullyCommitted: true);
}
