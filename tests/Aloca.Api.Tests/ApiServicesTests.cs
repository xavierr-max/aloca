using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class ApiServicesTests
{
    [Fact]
    public async Task CategoryService_CreatesCategoryAndRejectsNormalizedDuplicate()
    {
        await using var db = CreateDbContext();
        var service = new CategoryService(db);

        var created = await service.CreateAsync("  Alimentação ", CancellationToken.None);
        var duplicate = await service.CreateAsync("ALIMENTAÇÃO", CancellationToken.None);

        Assert.NotNull(created);
        Assert.Equal("Alimentação", created.Name);
        Assert.Null(duplicate);
    }

    [Fact]
    public async Task CategoryService_RejectsEmptyName()
    {
        await using var db = CreateDbContext();
        var service = new CategoryService(db);

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateAsync("  ", CancellationToken.None));
    }

    [Fact]
    public async Task CategoryService_DeletesCategoryAndDetachesFinancialRecords()
    {
        await using var db = CreateDbContext();
        var category = new Category("Moradia");
        db.Categories.Add(category);
        db.Transactions.Add(new Transaction("Aluguel", 750m, TransactionType.Expense, new DateOnly(2026, 9, 1), category.Id));
        var commitment = new FinancialCommitment("Reserva de aluguel", 750m, 1, 0, 0m, 1, true, new DateOnly(2026, 9, 1));
        commitment.SetCategory(category.Id);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var service = new CategoryService(db);

        var result = await service.DeleteAsync(category.Id, CancellationToken.None);

        Assert.Equal(CategoryDeleteStatus.Deleted, result);
        Assert.Null(await db.Categories.SingleOrDefaultAsync(x => x.Id == category.Id));
        Assert.Null((await db.Transactions.SingleAsync()).CategoryId);
        Assert.Null((await db.FinancialCommitments.SingleAsync()).CategoryId);
        Assert.NotNull(await db.Transactions.SingleOrDefaultAsync(x => x.Description == "Aluguel"));
    }

    [Fact]
    public async Task TransactionService_CreatesIncomeAndExpenseAndRejectsMissingCategory()
    {
        await using var db = CreateDbContext();
        var category = new Category("Salário");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var service = new TransactionService(db, new FinancialAllocationReconciliationService(db, new FinancialBalanceService(db)));

        var income = await service.CreateAsync(
            new TransactionRequest { Description = "Salário", Amount = 2_000m, Type = TransactionType.Income, Date = new DateOnly(2026, 9, 5), CategoryId = category.Id },
            CancellationToken.None);
        var expense = await service.CreateAsync(
            new TransactionRequest { Description = "Conta", Amount = 750m, Type = TransactionType.Expense, Date = new DateOnly(2026, 9, 6), CategoryId = category.Id },
            CancellationToken.None);
        var missingCategory = await service.CreateAsync(
            new TransactionRequest { Description = "Inválida", Amount = 10m, Type = TransactionType.Expense, Date = new DateOnly(2026, 9, 7), CategoryId = Guid.NewGuid() },
            CancellationToken.None);

        Assert.Equal(TransactionWriteStatus.Success, income.Status);
        Assert.Equal(TransactionWriteStatus.Success, expense.Status);
        Assert.Equal(TransactionWriteStatus.CategoryNotFound, missingCategory.Status);
    }

    [Fact]
    public async Task TransactionService_DeletePhysicallyRemovesExpenseFromFinancialTotals()
    {
        await using var db = CreateDbContext();
        var category = new Category("Geral");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var service = new TransactionService(db);
        var created = await service.CreateAsync(
            new TransactionRequest { Description = "Saída de teste", Amount = 100m, Type = TransactionType.Expense, Date = new DateOnly(2026, 9, 19), CategoryId = category.Id },
            CancellationToken.None);

        Assert.NotNull(created.Transaction);
        Assert.True(await service.DeleteAsync(created.Transaction!.Id, CancellationToken.None));

        Assert.Null(await db.Transactions.SingleOrDefaultAsync(x => x.Id == created.Transaction.Id));
        var summary = await new FinancialSummaryService(db).GetAsync(CancellationToken.None);
        Assert.Equal(0m, summary.TotalExpense);
        Assert.Equal(0m, summary.Balance);
    }

    [Fact]
    public async Task TransactionService_ListsExpensesWithoutCategory()
    {
        await using var db = CreateDbContext();
        db.Transactions.AddRange(
            new Transaction("Teste 2", 2m, TransactionType.Expense, new DateOnly(2026, 9, 18), null),
            new Transaction("Teste 5 A", 5m, TransactionType.Expense, new DateOnly(2026, 9, 18), null),
            new Transaction("Teste 5 B", 5m, TransactionType.Expense, new DateOnly(2026, 9, 18), null));
        await db.SaveChangesAsync();

        var result = await new TransactionService(db).GetAllAsync(
            new TransactionQueryParameters { Type = TransactionType.Expense, PageSize = 100 },
            CancellationToken.None);

        Assert.Equal(3, result.TotalCount);
        Assert.Equal(new[] { 2m, 5m, 5m }, result.Items.Select(x => x.Amount).OrderBy(x => x));
        Assert.All(result.Items, item => Assert.Null(item.CategoryId));
    }

    [Fact]
    public async Task TransactionService_PaginatesFilteredTransactionsWithStableOrderAndSafePageSize()
    {
        await using var db = CreateDbContext();
        db.Transactions.AddRange(
            new Transaction("A", 10m, TransactionType.Expense, new DateOnly(2026, 9, 1), null),
            new Transaction("B", 20m, TransactionType.Expense, new DateOnly(2026, 9, 1), null),
            new Transaction("C", 30m, TransactionType.Expense, new DateOnly(2026, 9, 2), null));
        await db.SaveChangesAsync();
        var service = new TransactionService(db);

        var first = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Expense, Page = 1, PageSize = 2 }, default);
        var next = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Expense, Page = 2, PageSize = 2 }, default);
        var last = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Expense, Page = 99, PageSize = 2 }, default);
        var capped = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Expense, PageSize = 1000 }, default);
        var empty = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Income, PageSize = 2 }, default);

        var repeatFirst = await service.GetAllAsync(new TransactionQueryParameters { Type = TransactionType.Expense, Page = 1, PageSize = 2 }, default);
        Assert.Equal(first.Items.Select(x => x.Id), repeatFirst.Items.Select(x => x.Id));
        Assert.Equal(2, first.Items.Count);
        Assert.Single(next.Items);
        Assert.Empty(first.Items.Select(x => x.Id).Intersect(next.Items.Select(x => x.Id)));
        Assert.Empty(last.Items);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(100, capped.PageSize);
        Assert.Equal(0, empty.TotalItems);
        Assert.Equal(0, empty.TotalPages);
    }

    [Fact]
    public async Task DeletingIncomeReconcilesReservationsWithinSameOperation()
    {
        await using var db = CreateDbContext();
        var settings = new FinancialSettingsService(db);
        await settings.UpdateAsync(500m, default);
        var transactions = new TransactionService(db);
        var income = await transactions.CreateAsync(new TransactionRequest
        {
            Description = "Entrada temporária", Amount = 200m, Type = TransactionType.Income,
            Date = DateOnly.FromDateTime(DateTime.UtcNow)
        }, default);
        var commitment = new FinancialCommitment("Compromisso", 1000m, 1, 0, 0m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        await new FinancialCommitmentService(db, new FinancialBalanceService(db)).AllocateAsync(commitment.Id, 700m, default);

        Assert.True(await transactions.DeleteAsync(income.Transaction!.Id, default));

        var summary = await new FinancialSummaryService(db).GetAsync(default);
        var saved = await db.FinancialCommitments.SingleAsync();
        Assert.Equal(500m, summary.Balance);
        Assert.Equal(500m, summary.TotalReservado);
        Assert.Equal(0m, summary.SaldoNaoAlocado);
        Assert.Equal(500m, saved.AllocatedAmount);
    }

    [Fact]
    public async Task CreatingExpenseReconcilesReservationsAndDeletingItReleasesBalance()
    {
        await using var db = CreateDbContext();
        await new FinancialSettingsService(db).UpdateAsync(700m, default);
        var commitment = new FinancialCommitment("Compromisso", 1000m, 1, 0, 700m, 1, true);
        db.FinancialCommitments.Add(commitment);
        await db.SaveChangesAsync();
        var transactions = new TransactionService(db);
        var expense = await transactions.CreateAsync(new TransactionRequest
        {
            Description = "Saída", Amount = 200m, Type = TransactionType.Expense,
            Date = DateOnly.FromDateTime(DateTime.UtcNow)
        }, default);

        var afterCreate = await new FinancialSummaryService(db).GetAsync(default);
        Assert.Equal(500m, afterCreate.Balance);
        Assert.Equal(500m, afterCreate.TotalReservado);
        Assert.Equal(0m, afterCreate.SaldoNaoAlocado);

        await transactions.DeleteAsync(expense.Transaction!.Id, default);
        var afterDelete = await new FinancialSummaryService(db).GetAsync(default);
        Assert.Equal(700m, afterDelete.Balance);
        Assert.Equal(500m, afterDelete.TotalReservado);
        Assert.Equal(200m, afterDelete.SaldoNaoAlocado);
    }

    [Fact]
    public void Transaction_RejectsInvalidAmountAndType()
    {
        var categoryId = Guid.NewGuid();

        Assert.Throws<ArgumentOutOfRangeException>(() => new Transaction("Teste", 0m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), categoryId));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Transaction("Teste", -1m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), categoryId));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Transaction("Teste", 1m, (TransactionType)99, DateOnly.FromDateTime(DateTime.UtcNow), categoryId));
    }

    [Fact]
    public async Task FinancialSummaryService_ReturnsIncomeMinusExpense()
    {
        await using var db = CreateDbContext();
        var category = new Category("Geral");
        db.Categories.Add(category);
        db.Transactions.AddRange(
            new Transaction("Entrada", 2_000m, TransactionType.Income, new DateOnly(2026, 9, 1), category.Id),
            new Transaction("Saída", 750m, TransactionType.Expense, new DateOnly(2026, 9, 2), category.Id));
        await db.SaveChangesAsync();

        var summary = await new FinancialSummaryService(db).GetAsync(CancellationToken.None);

        Assert.Equal(2_000m, summary.TotalIncome);
        Assert.Equal(750m, summary.TotalExpense);
        Assert.Equal(1_250m, summary.Balance);
    }

    [Fact]
    public async Task FinancialSummaryService_ReturnsZerosWithoutTransactions()
    {
        await using var db = CreateDbContext();

        var summary = await new FinancialSummaryService(db).GetAsync(CancellationToken.None);

        Assert.Equal(0m, summary.TotalIncome);
        Assert.Equal(0m, summary.TotalExpense);
        Assert.Equal(0m, summary.Balance);
    }

    [Fact]
    public async Task FinancialCommitmentService_AllowsNullPriorityAndGroupAndCanClearThem()
    {
        await using var db = CreateDbContext();
        var service = new FinancialCommitmentService(db, new FinancialBalanceService(db));
        var request = new FinancialCommitmentCreateRequest(
            "Compromisso sem classificação", 100m, 1, null, true,
            CategoryId: null, DueDate: DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1));

        var created = await service.CreateAsync(request, CancellationToken.None);
        Assert.Null(created.Priority);
        Assert.Null(created.CategoryId);

        var updated = await service.UpdateAsync(created.Id, new FinancialCommitmentUpdateRequest(
            created.Name, created.InstallmentAmount, created.TotalInstallments, null, created.IsFullyCommitted,
            CategoryId: null, DueDate: created.DueDate), CancellationToken.None);

        Assert.NotNull(updated);
        Assert.Null(updated!.Priority);
        Assert.Null(updated.CategoryId);
        Assert.Null((await service.GetByIdAsync(created.Id, CancellationToken.None))!.Priority);
    }

    private static AlocaDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase($"aloca-tests-{Guid.NewGuid()}")
            .Options);
}
