namespace Aloca.Api.Models;

public sealed class FinancialSettings
{
    private FinancialSettings() { }

    public FinancialSettings(decimal initialBalance)
    {
        if (initialBalance < 0) throw new ArgumentOutOfRangeException(nameof(initialBalance), "Initial balance cannot be negative.");
        Id = 1;
        InitialBalance = initialBalance;
    }

    public int Id { get; private set; }

    public decimal InitialBalance { get; private set; }

    public void UpdateInitialBalance(decimal initialBalance)
    {
        if (initialBalance < 0) throw new ArgumentOutOfRangeException(nameof(initialBalance), "Initial balance cannot be negative.");
        InitialBalance = initialBalance;
    }
}
