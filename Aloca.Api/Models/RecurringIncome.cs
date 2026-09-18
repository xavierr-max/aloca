namespace Aloca.Api.Models;

public sealed class RecurringIncome
{
    private RecurringIncome() { }

    public RecurringIncome(string description, decimal amount, Guid categoryId, RecurringIncomeFrequency frequency, DateOnly startDate, DateOnly? endDate, int? dayOfMonth)
    {
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));
        if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
        if (categoryId == Guid.Empty) throw new ArgumentException("Category is required.", nameof(categoryId));
        if (!Enum.IsDefined(frequency)) throw new ArgumentOutOfRangeException(nameof(frequency));
        if (endDate < startDate) throw new ArgumentException("End date cannot be before start date.", nameof(endDate));
        if (frequency == RecurringIncomeFrequency.Monthly && dayOfMonth is < 1 or > 31) throw new ArgumentOutOfRangeException(nameof(dayOfMonth));
        Id = Guid.NewGuid(); Description = description.Trim(); Amount = amount; CategoryId = categoryId; Frequency = frequency;
        StartDate = startDate; EndDate = endDate; DayOfMonth = dayOfMonth; IsActive = true; CreatedAt = DateTime.UtcNow; UpdatedAt = CreatedAt;
    }

    public Guid Id { get; private set; }
    public string Description { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public Guid CategoryId { get; private set; }
    public Category Category { get; private set; } = null!;
    public RecurringIncomeFrequency Frequency { get; private set; }
    public DateOnly StartDate { get; private set; }
    public DateOnly? EndDate { get; private set; }
    public int? DayOfMonth { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }
    public ICollection<RecurringIncomeOccurrence> Occurrences { get; private set; } = new List<RecurringIncomeOccurrence>();

    public void Update(string description, decimal amount, Guid categoryId, RecurringIncomeFrequency frequency, DateOnly startDate, DateOnly? endDate, int? dayOfMonth)
    {
        if (string.IsNullOrWhiteSpace(description) || amount <= 0 || categoryId == Guid.Empty || !Enum.IsDefined(frequency) || endDate < startDate || (frequency == RecurringIncomeFrequency.Monthly && dayOfMonth is < 1 or > 31)) throw new ArgumentException("Recurring income data is invalid.");
        Description = description.Trim(); Amount = amount; CategoryId = categoryId; Frequency = frequency; StartDate = startDate; EndDate = endDate; DayOfMonth = dayOfMonth; UpdatedAt = DateTime.UtcNow;
    }
    public void SetActive(bool active) { IsActive = active; UpdatedAt = DateTime.UtcNow; }
}
