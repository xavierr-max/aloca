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
        Guid? recurringIncomeOccurrenceId = null)
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

        if (type == TransactionType.Income && (!categoryId.HasValue || categoryId == Guid.Empty))
            throw new ArgumentException("Category is required for income transactions.", nameof(categoryId));

        Id = Guid.NewGuid();
        Description = description.Trim();
        Amount = amount;
        Type = type;
        Date = date;
        CreatedAt = DateTime.UtcNow;
        CategoryId = categoryId;
        RecurringIncomeOccurrenceId = recurringIncomeOccurrenceId;
    }

    public Guid Id { get; private set; }

    public string Description { get; private set; } = null!;

    public decimal Amount { get; private set; }

    public TransactionType Type { get; private set; }

    public DateOnly Date { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public Guid? CategoryId { get; private set; }

    public Category Category { get; private set; } = null!;

    public Guid? RecurringIncomeOccurrenceId { get; private set; }

    public void DetachRecurringIncomeOccurrence() => RecurringIncomeOccurrenceId = null;

    public void UpdateDetails(string description, decimal amount, DateOnly date, Guid? categoryId)
    {
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Transaction description is required.", nameof(description));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        if (Type == TransactionType.Income && !categoryId.HasValue) throw new ArgumentException("Category is required for income transactions.", nameof(categoryId));
        Description = description.Trim(); Amount = amount; Date = date; CategoryId = categoryId;
    }

}
