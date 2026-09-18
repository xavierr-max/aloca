namespace Aloca.Api.Models;

public sealed class RecurringIncomeOccurrence
{
    private RecurringIncomeOccurrence() { }
    public RecurringIncomeOccurrence(RecurringIncome recurringIncome, DateOnly scheduledDate)
    {
        Id = Guid.NewGuid(); RecurringIncomeId = recurringIncome.Id; ScheduledDate = scheduledDate; Amount = recurringIncome.Amount; Status = RecurringIncomeOccurrenceStatus.Planned; CreatedAt = DateTime.UtcNow;
    }
    public Guid Id { get; private set; }
    public Guid RecurringIncomeId { get; private set; }
    public RecurringIncome RecurringIncome { get; private set; } = null!;
    public DateOnly ScheduledDate { get; private set; }
    public decimal Amount { get; private set; }
    public RecurringIncomeOccurrenceStatus Status { get; private set; }
    public Guid? TransactionId { get; private set; }
    public Transaction? Transaction { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public void Receive(Guid transactionId) { if (Status == RecurringIncomeOccurrenceStatus.Received) return; Status = RecurringIncomeOccurrenceStatus.Received; TransactionId = transactionId; }
    public void Cancel() { if (Status == RecurringIncomeOccurrenceStatus.Planned) Status = RecurringIncomeOccurrenceStatus.Cancelled; }
}
