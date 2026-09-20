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
    public RecurringIncomeOccurrenceCancellationSource? CancellationSource { get; private set; }
    public Guid? TransactionId { get; private set; }
    public Transaction? Transaction { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public void Receive(Guid transactionId)
    {
        if (Status is RecurringIncomeOccurrenceStatus.Cancelled or RecurringIncomeOccurrenceStatus.Paused || TransactionId.HasValue) return;
        Status = RecurringIncomeOccurrenceStatus.Received;
        TransactionId = transactionId;
    }

    public void LinkExistingTransaction(Guid transactionId)
    {
        TransactionId = transactionId;
        Status = RecurringIncomeOccurrenceStatus.Received;
    }
    public void RestoreAfterTransactionDeletion()
    {
        if (Status == RecurringIncomeOccurrenceStatus.Received && TransactionId.HasValue)
        {
            TransactionId = null;
            Status = RecurringIncomeOccurrenceStatus.Planned;
        }
    }
    public void Cancel(RecurringIncomeOccurrenceCancellationSource source = RecurringIncomeOccurrenceCancellationSource.User)
    {
        if (Status == RecurringIncomeOccurrenceStatus.Planned)
        {
            Status = RecurringIncomeOccurrenceStatus.Cancelled;
            CancellationSource = source;
        }
    }
    public void Pause() { if (Status == RecurringIncomeOccurrenceStatus.Planned) Status = RecurringIncomeOccurrenceStatus.Paused; }
    public void RestoreAfterPause()
    {
        if (Status == RecurringIncomeOccurrenceStatus.Paused ||
            (Status == RecurringIncomeOccurrenceStatus.Cancelled && CancellationSource != RecurringIncomeOccurrenceCancellationSource.User))
        {
            Status = RecurringIncomeOccurrenceStatus.Planned;
            CancellationSource = null;
        }
    }
    public void RestoreLegacyForecast()
    {
        if (Status == RecurringIncomeOccurrenceStatus.Cancelled && TransactionId is null && CancellationSource != RecurringIncomeOccurrenceCancellationSource.User)
        {
            Status = RecurringIncomeOccurrenceStatus.Planned;
            CancellationSource = null;
        }
    }
    public void Expire()
    {
        if (Status is RecurringIncomeOccurrenceStatus.Planned or RecurringIncomeOccurrenceStatus.Paused)
        {
            Status = RecurringIncomeOccurrenceStatus.Cancelled;
            CancellationSource = RecurringIncomeOccurrenceCancellationSource.SystemExpiry;
        }
    }
}
