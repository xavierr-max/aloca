using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class ForecastEventNormalizerTests
{
    private static readonly DateOnly From = new(2026, 9, 1);
    private static readonly DateOnly To = new(2026, 9, 30);

    [Fact]
    public async Task NormalizesIncomeTransactionAsRealizedIncome()
    {
        await using var db = CreateDb();
        var transaction = new Transaction("Salário", 2000m, TransactionType.Income, new(2026, 9, 5), null);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        var item = Assert.Single(result);
        Assert.Equal(ForecastEventType.Income, item.Type);
        Assert.Equal(ForecastEventStatus.Realized, item.Status);
        Assert.Equal(transaction.Id.ToString("N"), item.SourceId);
        Assert.Equal(transaction.Id, item.TransactionId);
    }

    [Fact]
    public async Task NormalizesExpenseTransactionAsRealizedExpense()
    {
        await using var db = CreateDb();
        var transaction = new Transaction("Conta", 150m, TransactionType.Expense, new(2026, 9, 6), null);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var item = Assert.Single(await Normalize(db));

        Assert.Equal(ForecastEventType.Expense, item.Type);
        Assert.Equal(ForecastEventStatus.Realized, item.Status);
        Assert.Equal(transaction.Id, item.TransactionId);
    }

    [Fact]
    public async Task NormalizesPlannedOccurrenceAsPlannedIncome()
    {
        await using var db = CreateDb();
        var income = new RecurringIncome("Mensalidade", 300m, null, RecurringIncomeFrequency.Monthly, From, null, 10);
        var occurrence = new RecurringIncomeOccurrence(income, new(2026, 9, 10));
        db.RecurringIncomes.Add(income);
        db.RecurringIncomeOccurrences.Add(occurrence);
        await db.SaveChangesAsync();

        var item = Assert.Single(await Normalize(db));

        Assert.Equal(ForecastEventType.Income, item.Type);
        Assert.Equal(ForecastEventStatus.Planned, item.Status);
        Assert.Equal(occurrence.Id, item.RecurringIncomeOccurrenceId);
        Assert.Equal(income.Id, item.RecurringIncomeId);
    }

    [Fact]
    public async Task ReceivedOccurrenceProducesOnlyRealizedTransaction()
    {
        await using var db = CreateDb();
        var income = new RecurringIncome("Recebida", 300m, null, RecurringIncomeFrequency.Monthly, From, null, 10);
        var occurrence = new RecurringIncomeOccurrence(income, new(2026, 9, 10));
        var transaction = new Transaction("Recebida", 300m, TransactionType.Income, new(2026, 9, 20), null, occurrence.Id);
        occurrence.Receive(transaction.Id);
        db.RecurringIncomes.Add(income);
        db.RecurringIncomeOccurrences.Add(occurrence);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        var item = Assert.Single(result);
        Assert.Equal(ForecastEventStatus.Realized, item.Status);
        Assert.Equal(new DateOnly(2026, 9, 20), item.AccountingDate);
        Assert.Equal(transaction.Id, item.TransactionId);
    }

    [Fact]
    public async Task PlannedOccurrenceWithTransactionIdIsNotDuplicated()
    {
        await using var db = CreateDb();
        var income = new RecurringIncome("Vínculo legado", 300m, null, RecurringIncomeFrequency.Monthly, From, null, 10);
        var occurrence = new RecurringIncomeOccurrence(income, new(2026, 9, 10));
        occurrence.LinkExistingTransaction(Guid.NewGuid());
        db.RecurringIncomes.Add(income);
        db.RecurringIncomeOccurrences.Add(occurrence);
        await db.SaveChangesAsync();

        Assert.Empty(await Normalize(db));
    }

    [Fact]
    public async Task NormalizesPendingInstallmentAsPlannedExpense()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Aluguel", 800m, 2, 0, 0m, null, true, new(2026, 9, 12));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        var item = Assert.Single(result);
        Assert.Equal(ForecastEventType.Expense, item.Type);
        Assert.Equal(ForecastEventStatus.Planned, item.Status);
        Assert.Equal(commitment.Id, item.FinancialCommitmentId);
        Assert.Equal(1, item.InstallmentNumber);
        Assert.Equal(800m, item.Amount);
    }

    [Fact]
    public async Task AllocationDoesNotCreateFinancialEvent()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Curso", 500m, 1, 0, 0m, null, true, new(2026, 9, 15));
        commitment.Allocate(500m);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        var item = Assert.Single(result);
        Assert.Equal(ForecastEventOrigin.FinancialCommitmentInstallment, item.Origin);
        Assert.Equal(500m, item.Amount);
    }

    [Fact]
    public async Task PaidInstallmentProducesOnlyRealizedPaymentTransaction()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Pago", 800m, 1, 1, 0m, null, true, new(2026, 9, 12));
        var payment = new CommitmentPayment(commitment.Id, 800m, 1, DateTime.UtcNow);
        var transaction = new Transaction("Pago", 800m, TransactionType.Expense, new(2026, 9, 18), null,
            financialCommitmentId: commitment.Id, commitmentPaymentId: payment.Id);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(payment);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var item = Assert.Single(await Normalize(db));
        Assert.Equal(ForecastEventStatus.Realized, item.Status);
        Assert.Equal(new DateOnly(2026, 9, 18), item.AccountingDate);
        Assert.Equal(transaction.Id, item.TransactionId);
    }

    [Fact]
    public async Task AutomaticPaymentUsesTheSameRealizedRule()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Automático", 400m, 1, 1, 0m, null, true, new(2026, 9, 12), automaticProcessing: true);
        var payment = new CommitmentPayment(commitment.Id, 400m, 1, DateTime.UtcNow, wasAutomatic: true);
        var transaction = new Transaction("Automático", 400m, TransactionType.Expense, new(2026, 9, 19), null,
            financialCommitmentId: commitment.Id, wasAutomatic: true, commitmentPaymentId: payment.Id);
        db.FinancialCommitments.Add(commitment);
        db.CommitmentPayments.Add(payment);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var result = await Normalize(db);
        Assert.Single(result);
        Assert.Equal(ForecastEventStatus.Realized, result.Single().Status);
    }

    [Fact]
    public async Task ReversedPaymentReturnsTheInstallmentToPlanned()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Pagamento desfeito", 250m, 1, 0, 0m, null, true, new(2026, 9, 12));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        var item = Assert.Single(result);
        Assert.Equal(ForecastEventStatus.Planned, item.Status);
        Assert.Null(item.TransactionId);
        Assert.Equal(1, item.InstallmentNumber);
    }

    [Fact]
    public async Task MultiplePendingInstallmentsProduceOneEventPerUnpaidInstallment()
    {
        await using var db = CreateDb();
        var commitment = new FinancialCommitment("Parcelado", 100m, 3, 0, 0m, null, true, new(2026, 9, 5));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await Normalize(db, From, new(2026, 11, 30));

        Assert.Equal(3, result.Count);
        Assert.Equal(new[] { 1, 2, 3 }, result.Select(x => x.InstallmentNumber!.Value).ToArray());
        Assert.All(result, x => Assert.Equal(ForecastEventStatus.Planned, x.Status));
    }

    [Fact]
    public async Task PlannedAndRealizedSourcesNeverAppearTogetherForSameOccurrence()
    {
        await using var db = CreateDb();
        var income = new RecurringIncome("Única", 100m, null, RecurringIncomeFrequency.Monthly, From, null, 10);
        var occurrence = new RecurringIncomeOccurrence(income, new(2026, 9, 10));
        var transaction = new Transaction("Única", 100m, TransactionType.Income, new(2026, 9, 11), null, occurrence.Id);
        occurrence.Receive(transaction.Id);
        db.RecurringIncomes.Add(income);
        db.RecurringIncomeOccurrences.Add(occurrence);
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        Assert.Single(result);
        Assert.DoesNotContain(result, x => x.Status == ForecastEventStatus.Planned && x.RecurringIncomeOccurrenceId == occurrence.Id);
        Assert.Equal(transaction.Id, result.Single().TransactionId);
    }

    [Fact]
    public async Task EventCountMatchesUniqueFinancialOrigins()
    {
        await using var db = CreateDb();
        var income = new Transaction("Entrada", 100m, TransactionType.Income, new(2026, 9, 2), null);
        var expense = new Transaction("Saída", 40m, TransactionType.Expense, new(2026, 9, 3), null);
        var recurring = new RecurringIncome("Recorrente", 50m, null, RecurringIncomeFrequency.Monthly, From, null, 10);
        var occurrence = new RecurringIncomeOccurrence(recurring, new(2026, 9, 10));
        var commitment = new FinancialCommitment("Parcelas", 25m, 2, 0, 0m, null, true, new(2026, 9, 15));
        db.Transactions.AddRange(income, expense);
        db.RecurringIncomes.Add(recurring);
        db.RecurringIncomeOccurrences.Add(occurrence);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();

        var result = await Normalize(db);

        Assert.Equal(4, result.Count);
        Assert.Equal(result.Count, result.Select(x => x.SourceId).Distinct().Count());
    }

    [Fact]
    public async Task DoesNotIncludeAnotherAccount()
    {
        var databaseName = $"forecast-{Guid.NewGuid()}";
        var firstAccessor = new CurrentUserAccessor();
        var firstUser = Guid.NewGuid();
        firstAccessor.Set(firstUser);
        await using (var firstDb = CreateDb(databaseName, firstAccessor))
        {
            firstDb.Transactions.Add(new Transaction("Minha entrada", 100m, TransactionType.Income, new(2026, 9, 5), null));
            await firstDb.SaveChangesAsync();
        }

        var secondAccessor = new CurrentUserAccessor();
        secondAccessor.Set(Guid.NewGuid());
        await using var secondDb = CreateDb(databaseName, secondAccessor);
        secondDb.Transactions.Add(new Transaction("Outra conta", 900m, TransactionType.Income, new(2026, 9, 5), null));
        await secondDb.SaveChangesAsync();

        var result = await Normalize(secondDb);

        var item = Assert.Single(result);
        Assert.Equal("Outra conta", item.Description);
        Assert.DoesNotContain(result, x => x.Amount == 100m);
    }

    private static async Task<IReadOnlyCollection<ForecastEvent>> Normalize(AlocaDbContext db) =>
        await new ForecastEventNormalizer(db).NormalizeAsync(From, To, CancellationToken.None);

    private static async Task<IReadOnlyCollection<ForecastEvent>> Normalize(AlocaDbContext db, DateOnly from, DateOnly to) =>
        await new ForecastEventNormalizer(db).NormalizeAsync(from, to, CancellationToken.None);

    private static AlocaDbContext CreateDb() => CreateDb($"forecast-{Guid.NewGuid()}", null);

    private static AlocaDbContext CreateDb(string name, ICurrentUserAccessor? accessor) =>
        accessor is null
            ? new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(name).Options)
            : new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(name).Options, accessor);
}
