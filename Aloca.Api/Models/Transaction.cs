namespace Aloca.Api.Models;

public sealed class Transaction
{
    private Transaction()
    {
    }

    public Transaction(
        string description,
        decimal amount,
        TransactionType type,
        DateOnly date,
        Guid? categoryId,
        Guid? recurringIncomeOccurrenceId = null,
        Guid? financialCommitmentId = null,
        bool wasAutomatic = false,
        Guid? commitmentPaymentId = null)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Transaction description is required.", nameof(description));
        }

        if (amount <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(amount), "Transaction amount must be greater than zero.");
        }

        if (!Enum.IsDefined(type))
        {
            throw new ArgumentOutOfRangeException(nameof(type), "Transaction type is invalid.");
        }


        Id = Guid.NewGuid();
        Description = description.Trim();
        Amount = amount;
        Type = type;
        Date = date;
        CreatedAt = DateTime.UtcNow;
        CategoryId = categoryId;
        RecurringIncomeOccurrenceId = recurringIncomeOccurrenceId;
        FinancialCommitmentId = financialCommitmentId;
        WasAutomatic = wasAutomatic;
        CommitmentPaymentId = commitmentPaymentId;
        ProcessedAt = CreatedAt;
    }

    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public string Description { get; private set; } = null!;

    public decimal Amount { get; private set; }

    public TransactionType Type { get; private set; }

    public DateOnly Date { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }

    public Guid? CategoryId { get; private set; }

    public Category Category { get; private set; } = null!;

    public Guid? RecurringIncomeOccurrenceId { get; private set; }
    public Guid? FinancialCommitmentId { get; private set; }
    public bool WasAutomatic { get; private set; }
    public Guid? CommitmentPaymentId { get; private set; }

    public void DetachRecurringIncomeOccurrence() => RecurringIncomeOccurrenceId = null;

    public void DetachCategory() => CategoryId = null;

    public void UpdateDetails(string description, decimal amount, DateOnly date, Guid? categoryId)
    {
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Transaction description is required.", nameof(description));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        Description = description.Trim(); Amount = amount; Date = date; CategoryId = categoryId;
    }

}
