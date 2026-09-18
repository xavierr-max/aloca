using Aloca.Api.Data;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class FinancialProjectionTests
{
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

    private static async Task<Category> AddCategory(AlocaDbContext db)
    {
        var category = new Category("Geral");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        return category;
    }

    private static AlocaDbContext CreateDb() => new(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase($"projection-{Guid.NewGuid()}").Options);
}
