using Aloca.Api.Models;

namespace Aloca.Api.Tests;

public sealed class FinancialCommitmentTests
{
    [Fact]
    public void RegisterPaymentChangesOnlyPaidInstallments()
    {
        var commitment = new FinancialCommitment("Conta", 100m, 2, 0, null);
        Assert.Equal(100m, commitment.RegisterPayment());
        Assert.Equal(1, commitment.PaidInstallments);
        Assert.Equal(100m, commitment.RemainingAmount);
    }

    [Fact]
    public void CompletedCommitmentCannotBePaidAgain()
    {
        var commitment = new FinancialCommitment("Conta", 100m, 1, 0, null);
        commitment.RegisterPayment();
        Assert.Throws<InvalidOperationException>(() => commitment.RegisterPayment());
    }
}
