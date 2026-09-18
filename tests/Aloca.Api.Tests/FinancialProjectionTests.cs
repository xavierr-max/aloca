using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialProjectionTests
{
    [Fact]
    public void ProjectMonthMaintainsTheBalanceChainForTheRequestedMonths()
    {
        var months = new[]
        {
            (new DateOnly(2026, 9, 1), 120m, 80m),
            (new DateOnly(2026, 10, 1), 0m, 25m),
            (new DateOnly(2026, 11, 1), 150m, 0m),
            (new DateOnly(2026, 12, 1), 97m, 167.04m),
            (new DateOnly(2027, 1, 1), 300m, 0m),
            (new DateOnly(2027, 2, 1), 0m, 40m)
        };

        var opening = 386.20m;
        FinancialProjectionMonthResponse? previous = null;
        foreach (var (month, entries, expenses) in months)
        {
            var projection = FinancialProjectionService.ProjectMonth(
                month, opening,
                Enumerable.Repeat(new ProjectionMovementResponse($"in-{month}", "entrada", entries, month, null, false, null, null), entries == 0 ? 0 : 1).ToArray(),
                Enumerable.Repeat(new ProjectionMovementResponse($"out-{month}", "saída", expenses, month, null, false, null, null), expenses == 0 ? 0 : 1).ToArray());

            Assert.Equal(projection.OpeningBalance + projection.Entries - projection.ExpensesTotal, projection.ClosingBalance);
            if (previous is not null) Assert.Equal(previous.ClosingBalance, projection.OpeningBalance);
            if (expenses > entries) Assert.True(projection.ClosingBalance < projection.OpeningBalance);
            if (entries > expenses) Assert.True(projection.ClosingBalance > projection.OpeningBalance);
            if (entries == expenses) Assert.Equal(projection.OpeningBalance, projection.ClosingBalance);
            previous = projection;
            opening = projection.ClosingBalance;
        }

        var december = FinancialProjectionService.ProjectMonth(
            new DateOnly(2026, 12, 1), 386.20m,
            new[] { new ProjectionMovementResponse("dec-in", "entrada", 97m, new DateOnly(2026, 12, 10), null, false, null, null) },
            new[] { new ProjectionMovementResponse("dec-out", "saída", 167.04m, new DateOnly(2026, 12, 15), null, false, null, null) });
        Assert.Equal(-70.04m, december.NetResult);
        Assert.Equal(316.16m, december.ClosingBalance);
    }

    [Fact]
    public async Task ProjectsMonthlyGrowthFromFutureIncomeAndCommitmentInstallments()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.RecurringIncomes.Add(new RecurringIncome("Salário", 2000m, category.Id, RecurringIncomeFrequency.Monthly, today.AddDays(1), null, today.Day));
        db.FinancialCommitments.Add(new FinancialCommitment("Aluguel", 1000m, 3, 0, 0, 1, true, today.AddMonths(1)));
        await db.SaveChangesAsync();
        await new RecurringIncomeService(db).EnsureOccurrencesAsync(today.AddMonths(3), default);

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.Equal(1000m, projection.CurrentBalance);
        Assert.Equal(2000m, projection.Months.First().TotalIncome);
        Assert.Equal(3000m, projection.Months.First().ProjectedBalance);
        Assert.Equal(2000m, projection.Months.Skip(1).First().TotalIncome);
        Assert.Equal(1000m, projection.Months.Skip(1).First().TotalExpense);
        Assert.Equal(4000m, projection.Months.Skip(1).First().ProjectedBalance);
    }

    [Fact]
    public async Task ExcludesPausedRecurringIncomeAndPaidInstallments()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var recurring = new RecurringIncome("Salário", 2000m, category.Id, RecurringIncomeFrequency.Monthly, today.AddDays(1), null, today.Day);
        db.RecurringIncomes.Add(recurring);
        var commitment = new FinancialCommitment("Notebook", 300m, 3, 1, 0, 1, true, today.AddMonths(1));
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        await new RecurringIncomeService(db).EnsureOccurrencesAsync(today.AddMonths(3), default);
        await new RecurringIncomeService(db).SetActiveAsync(recurring.Id, false, default);

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.Equal(0m, projection.TotalProjectedIncome);
        Assert.Equal(300m, projection.TotalProjectedExpense);
        Assert.DoesNotContain(projection.Months.SelectMany(x => x.Expenses), x => x.Installment == 1);
        Assert.Contains(projection.Months.SelectMany(x => x.Expenses), x => x.Installment == 2);
    }

    [Fact]
    public async Task ProjectsTodaysUnpaidInstallmentAsTheFirstInstallment()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialCommitments.Add(new FinancialCommitment("pacote-valorant", 63.66m, 3, 0, 0m, 1, true, today));
        db.FinancialCommitments.Add(new FinancialCommitment("pacote-valorant(refund)", 66.67m, 3, 0, 0m, 1, true, today));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(12, default);
        var expenses = projection.Months.SelectMany(x => x.Expenses).ToList();

        Assert.Equal(390.99m, projection.TotalProjectedExpense);
        Assert.Equal(130.33m, projection.Months.First().TotalExpense);
        Assert.Equal(130.33m, projection.Months.Skip(1).First().TotalExpense);
        Assert.Equal(130.33m, projection.Months.Skip(2).First().TotalExpense);
        Assert.Equal(new[] { 1, 2, 3 }, expenses.Where(x => x.Description == "pacote-valorant").Select(x => x.Installment!.Value));
        Assert.Equal(new[] { 1, 2, 3 }, expenses.Where(x => x.Description == "pacote-valorant(refund)").Select(x => x.Installment!.Value));
        Assert.DoesNotContain(expenses, x => x.Date == today.AddMonths(3));
    }

    [Fact]
    public async Task DoesNotProjectACommitmentBeforeItsFirstDueDate()
    {
        await using var db = CreateDb();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialCommitments.Add(new FinancialCommitment("Outubro", 100m, 3, 0, 0m, 1, true, today.AddMonths(1)));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.DoesNotContain(projection.Months.First().Expenses, x => x.Description == "Outubro");
        Assert.Equal(100m, projection.Months.Skip(1).First().TotalExpense);
        Assert.Equal(100m, projection.Months.Skip(2).First().TotalExpense);
    }

    [Fact]
    public async Task KeepsNegativeBalancesAndPlacesOneOffIncomeInItsMonth()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialSettings.Add(new FinancialSettings(100m));
        db.Transactions.Add(new Transaction("Freelance", 50m, TransactionType.Income, today.AddMonths(2), category.Id));
        db.FinancialCommitments.Add(new FinancialCommitment("Conta", 300m, 1, 0, 0, 1, true, today.AddMonths(1)));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.Equal(-200m, projection.Months.ElementAt(1).ProjectedBalance);
        Assert.Equal(50m, projection.Months.ElementAt(2).TotalIncome);
        Assert.Equal(-150m, projection.Months.ElementAt(2).ProjectedBalance);
    }

    [Fact]
    public async Task IncludesDistinctOneOffIncomesWithTheSameDescriptionAndClosesAllTotals()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialSettings.Add(new FinancialSettings(500m));
        db.Transactions.Add(new Transaction("Mesada", 100m, TransactionType.Income, today.AddDays(1), category.Id));
        db.Transactions.Add(new Transaction("Mesada", 200m, TransactionType.Income, today.AddDays(2), category.Id));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);
        var month = projection.Months.First();

        Assert.Equal(300m, month.TotalIncome);
        Assert.Equal(2, month.Incomes.Count);
        Assert.Equal(300m, projection.TotalProjectedIncome);
        Assert.Equal(projection.Months.Sum(x => x.TotalIncome), projection.TotalProjectedIncome);
        Assert.Equal(projection.Months.SelectMany(x => x.Incomes).Sum(x => x.Amount), projection.TotalProjectedIncome);
    }

    [Fact]
    public async Task IncludesThreeFutureRecurringOccurrences()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.RecurringIncomes.Add(new RecurringIncome("Mesada", 80m, category.Id, RecurringIncomeFrequency.Monthly, today, null, today.Day));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.Equal(240m, projection.TotalProjectedIncome);
        Assert.Equal(3, projection.Months.SelectMany(x => x.Incomes).Count());
        Assert.All(projection.Months.SelectMany(x => x.Incomes), x => Assert.True(x.Recurring));
    }

    [Fact]
    public async Task CountsReceivedRecurringOccurrenceOnlyOnce()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var recurring = new RecurringIncome("Mesada", 80m, category.Id, RecurringIncomeFrequency.Monthly, today, null, today.Day);
        db.RecurringIncomes.Add(recurring);
        await db.SaveChangesAsync();
        var recurringService = new RecurringIncomeService(db);
        await recurringService.EnsureOccurrencesAsync(today.AddMonths(3), default);
        var received = await db.RecurringIncomeOccurrences.SingleAsync(x => x.ScheduledDate == today);
        await recurringService.ReceiveAsync(received.Id, default);

        var projection = await new FinancialProjectionService(db, recurringService).GetAsync(3, default);

        Assert.Equal(160m, projection.TotalProjectedIncome);
        Assert.DoesNotContain(projection.Months.SelectMany(x => x.Incomes), x => x.Id == received.Id.ToString());
        Assert.Equal(80m, projection.CurrentBalance);
    }

    [Fact]
    public async Task ExcludesOneOffIncomeOutsideTheSelectedPeriodAndPausedRecurringIncome()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var recurring = new RecurringIncome("Pausada", 80m, category.Id, RecurringIncomeFrequency.Monthly, today, null, today.Day);
        db.RecurringIncomes.Add(recurring);
        db.Transactions.Add(new Transaction("Fora", 500m, TransactionType.Income, today.AddMonths(3), category.Id));
        await db.SaveChangesAsync();
        var recurringService = new RecurringIncomeService(db);
        await recurringService.SetActiveAsync(recurring.Id, false, default);

        var projection = await new FinancialProjectionService(db, recurringService).GetAsync(3, default);

        Assert.Equal(0m, projection.TotalProjectedIncome);
        Assert.Empty(projection.Months.SelectMany(x => x.Incomes));
    }

    [Fact]
    public async Task KeepsMovementsOnTheFirstDayOfTheNextMonthOutOfTheSelectedMonth()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var nextMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(1);
        db.Transactions.Add(new Transaction("Limite", 100m, TransactionType.Expense, nextMonth, category.Id));
        db.Transactions.Add(new Transaction("Dentro", 75m, TransactionType.Expense, nextMonth.AddDays(-1), category.Id));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);

        Assert.Equal(75m, projection.Months.First().TotalExpense);
        Assert.DoesNotContain(projection.Months.First().Expenses, x => x.Description == "Limite");
        Assert.Contains(projection.Months.Skip(1).SelectMany(x => x.Expenses), x => x.Description == "Limite");
    }

    [Fact]
    public async Task FinalBalanceAndExpenseTotalsAreDerivedFromMonthlyRows()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada", 250m, TransactionType.Income, today.AddMonths(1), category.Id));
        db.Transactions.Add(new Transaction("Saída", 75m, TransactionType.Expense, today.AddMonths(1), category.Id));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);
        var months = projection.Months.ToList();

        Assert.Equal(months.Sum(x => x.TotalIncome), projection.TotalProjectedIncome);
        Assert.Equal(months.SelectMany(x => x.Incomes).Sum(x => x.Amount), projection.TotalProjectedIncome);
        Assert.Equal(months.Sum(x => x.TotalExpense), projection.TotalProjectedExpense);
        Assert.Equal(months.SelectMany(x => x.Expenses).Sum(x => x.Amount), projection.TotalProjectedExpense);
        Assert.Equal(months[^1].ProjectedBalance, projection.FinalProjectedBalance);
        for (var i = 0; i < months.Count; i++)
        {
            Assert.Equal(months[i].OpeningBalance + months[i].TotalIncome - months[i].TotalExpense, months[i].ProjectedBalance);
            if (i > 0) Assert.Equal(months[i - 1].ProjectedBalance, months[i].OpeningBalance);
        }
    }

    [Fact]
    public async Task StartsAtRealBalanceAndDoesNotCountReservationsAsFutureExpenses()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var firstFutureMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(1);

        db.FinancialSettings.Add(new FinancialSettings(490.28m));
        db.Transactions.Add(new Transaction("Entrada 1", 80m, TransactionType.Income, firstFutureMonth.AddDays(1), category.Id));
        db.Transactions.Add(new Transaction("Entrada 2", 80m, TransactionType.Income, firstFutureMonth.AddMonths(1).AddDays(1), category.Id));
        db.FinancialCommitments.Add(new FinancialCommitment("Compra", 66.30m, 2, 0, 132.60m, 1, true, firstFutureMonth));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(3, default);
        var months = projection.Months.ToList();

        Assert.Equal(490.28m, projection.CurrentBalance);
        Assert.Equal(160m, projection.TotalProjectedIncome);
        Assert.Equal(132.60m, projection.TotalProjectedExpense);
        Assert.Equal(517.68m, projection.FinalProjectedBalance);
        Assert.Equal(490.28m, months[0].ProjectedBalance);
        Assert.Equal(503.98m, months[1].ProjectedBalance);
        Assert.Equal(517.68m, months[2].ProjectedBalance);
        Assert.Equal(new[] { "Entrada 1" }, months[1].Incomes.Select(x => x.Description));
        Assert.Equal(new[] { "Entrada 2" }, months[2].Incomes.Select(x => x.Description));
        Assert.Equal(new[] { 1 }, months[1].Expenses.Select(x => x.Installment!.Value));
        Assert.Equal(new[] { 2 }, months[2].Expenses.Select(x => x.Installment!.Value));
    }

    [Fact]
    public async Task FutureMonthProjectionUsesAccumulatedOpeningBalance()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var currentMonth = new DateOnly(today.Year, today.Month, 1);
        var selectedMonth = currentMonth.AddMonths(2);

        db.FinancialSettings.Add(new FinancialSettings(1000m));
        db.Transactions.Add(new Transaction("Entrada anterior", 200m, TransactionType.Income, currentMonth.AddMonths(1).AddDays(1), category.Id));
        db.Transactions.Add(new Transaction("Saída selecionada", 50m, TransactionType.Expense, selectedMonth.AddDays(1), category.Id));
        await db.SaveChangesAsync();

        var service = new FinancialProjectionService(db, new RecurringIncomeService(db));
        var full = await service.GetAsync(4, default);
        var selected = await service.GetAsync(1, selectedMonth, default);
        var expected = full.Months.Single(x => x.Month == selectedMonth);
        var actual = selected.Months.Single(x => x.Month == selectedMonth);

        Assert.Equal(expected.OpeningBalance, actual.OpeningBalance);
        Assert.Equal(expected.ProjectedBalance, actual.ProjectedBalance);
        Assert.Equal(1200m, actual.OpeningBalance);
        Assert.Equal(1150m, actual.ProjectedBalance);
        Assert.Equal(expected.TotalIncome, actual.TotalIncome);
        Assert.Equal(expected.TotalExpense, actual.TotalExpense);
    }

    [Fact]
    public async Task ProjectionCanReachAMonthBeyondTheChartWindow()
    {
        await using var db = CreateDb();
        var category = await AddCategory(db);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var selectedMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(5);
        db.FinancialSettings.Add(new FinancialSettings(500m));
        db.Transactions.Add(new Transaction("Entrada selecionada", 100m, TransactionType.Income, selectedMonth.AddDays(1), category.Id));
        db.Transactions.Add(new Transaction("Saída selecionada", 25m, TransactionType.Expense, selectedMonth.AddDays(2), category.Id));
        await db.SaveChangesAsync();

        var projection = await new FinancialProjectionService(db, new RecurringIncomeService(db)).GetAsync(6, default);
        var month = projection.Months.Single(x => x.Month == selectedMonth);

        Assert.Equal(100m, month.TotalIncome);
        Assert.Equal(25m, month.TotalExpense);
        Assert.Equal(month.OpeningBalance + month.TotalIncome - month.TotalExpense, month.ProjectedBalance);
    }

    private static async Task<Category> AddCategory(AlocaDbContext db)
    {
        var category = new Category("Geral");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase($"projection-{Guid.NewGuid()}").Options);
}
