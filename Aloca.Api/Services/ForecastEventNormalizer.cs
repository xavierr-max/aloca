namespace Aloca.Api.Services;

using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

public interface IForecastEventNormalizer
{
    Task<IReadOnlyCollection<ForecastEvent>> NormalizeAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken);
}

/// <summary>
/// Converts transactions, recurring occurrences and commitment installments
/// into the common event contract used by the forecast pipeline.
/// </summary>
public sealed class ForecastEventNormalizer(AlocaDbContext db, IBusinessClock? clock = null) : IForecastEventNormalizer
{
    private IBusinessClock Clock => clock ?? new SystemBusinessClock(new ConfigurationBuilder().Build());
    public async Task<IReadOnlyCollection<ForecastEvent>> NormalizeAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfGreaterThan(from, to);
        cancellationToken.ThrowIfCancellationRequested();

        var transactions = await db.Transactions
            .AsNoTracking()
            .Include(x => x.Category)
            .Where(x => x.Date >= from && x.Date <= to && !x.IsBalanceAdjustment && x.Description != "Ajuste manual de saldo")
            .OrderBy(x => x.Date)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var occurrences = await db.RecurringIncomeOccurrences
            .AsNoTracking()
            .Include(x => x.RecurringIncome)
            .ThenInclude(x => x.Category)
            .Where(x => x.ScheduledDate >= from && x.ScheduledDate <= to &&
                        x.Status != RecurringIncomeOccurrenceStatus.Cancelled &&
                        x.Status != RecurringIncomeOccurrenceStatus.Paused)
            .OrderBy(x => x.ScheduledDate)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var occurrenceIds = occurrences.Select(x => x.Id).ToArray();
        var confirmedOccurrenceIds = await db.Transactions
            .AsNoTracking()
            .Where(x => x.RecurringIncomeOccurrenceId.HasValue &&
                        occurrenceIds.Contains(x.RecurringIncomeOccurrenceId.Value))
            .Select(x => x.RecurringIncomeOccurrenceId!.Value)
            .ToHashSetAsync(cancellationToken);

        var commitments = await db.FinancialCommitments
            .AsNoTracking()
            .Include(x => x.Category)
            .Where(x => x.DueDate <= to &&
                        (x.EndDate == null || x.EndDate >= from) &&
                        (x.TotalInstallments == 0 || x.PaidInstallments < x.TotalInstallments))
            .OrderBy(x => x.DueDate)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var commitmentIds = commitments.Select(x => x.Id).ToArray();
        var paidInstallments = await db.CommitmentPayments
            .AsNoTracking()
            .Where(x => commitmentIds.Contains(x.FinancialCommitmentId))
            .Select(x => new { x.Id, x.FinancialCommitmentId, x.InstallmentNumber })
            .ToListAsync(cancellationToken);
        var paymentIds = paidInstallments.Select(x => x.Id).ToArray();
        var confirmedPaymentIds = await db.Transactions
            .AsNoTracking()
            .Where(x => x.CommitmentPaymentId.HasValue && paymentIds.Contains(x.CommitmentPaymentId.Value))
            .Select(x => x.CommitmentPaymentId!.Value)
            .ToHashSetAsync(cancellationToken);
        var paidKeys = paidInstallments
            .Where(x => confirmedPaymentIds.Contains(x.Id))
            .Select(x => (x.FinancialCommitmentId, x.InstallmentNumber))
            .ToHashSet();

        var events = new List<ForecastEvent>(transactions.Count + occurrences.Count);

        foreach (var transaction in transactions)
        {
            events.Add(new(
                transaction.Id.ToString("N"),
                transaction.Type == TransactionType.Income ? ForecastEventType.Income : ForecastEventType.Expense,
                transaction.Date <= Clock.Today ? ForecastEventStatus.Realized : ForecastEventStatus.Planned,
                transaction.Amount,
                transaction.Date,
                null,
                transaction.CategoryId,
                transaction.Category?.Name,
                null,
                transaction.FinancialCommitmentId,
                null,
                transaction.Id,
                ForecastEventOrigin.Transaction,
                transaction.Description,
                transaction.RecurringIncomeOccurrenceId));
        }

        foreach (var occurrence in occurrences)
        {
            // Received occurrences and occurrences carrying a confirmed
            // transaction are represented by that transaction only. A
            // Planned row with a transaction link is treated the same way to
            // protect against legacy or partially repaired data.
            if (occurrence.Status != RecurringIncomeOccurrenceStatus.Planned ||
                occurrence.TransactionId.HasValue ||
                confirmedOccurrenceIds.Contains(occurrence.Id)) continue;

            events.Add(new(
                occurrence.Id.ToString("N"),
                ForecastEventType.Income,
                ForecastEventStatus.Planned,
                occurrence.Amount,
                occurrence.ScheduledDate,
                occurrence.ScheduledDate,
                occurrence.RecurringIncome.CategoryId,
                occurrence.RecurringIncome.Category?.Name,
                occurrence.RecurringIncomeId,
                null,
                null,
                null,
                ForecastEventOrigin.RecurringIncomeOccurrence,
                occurrence.RecurringIncome.Description,
                occurrence.Id));
        }

        foreach (var commitment in commitments)
        {
            foreach (var installment in FinancialCommitmentSchedule.GetPendingInstallments(commitment, from, to)
                         .Where(x => x.DueDate >= from && x.DueDate <= to))
            {
                if (paidKeys.Contains((commitment.Id, installment.Number))) continue;

                events.Add(new(
                    $"{commitment.Id:N}:{installment.Number}",
                    ForecastEventType.Expense,
                    ForecastEventStatus.Planned,
                    installment.Amount,
                    installment.DueDate,
                    installment.DueDate,
                    commitment.CategoryId,
                    commitment.Category?.Name,
                    null,
                    commitment.Id,
                    installment.Number,
                    null,
                    ForecastEventOrigin.FinancialCommitmentInstallment,
                    commitment.Name,
                    null));
            }
        }

        return events;
    }
}
