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
    public async Task CategoryService_PreventsDeletingCategoryInUse()
    {
        await using var db = CreateDbContext();
        var category = new Category("Moradia");
        db.Categories.Add(category);
        db.Transactions.Add(new Transaction("Aluguel", 750m, TransactionType.Expense, new DateOnly(2026, 9, 1), category.Id));
        await db.SaveChangesAsync();
        var service = new CategoryService(db);

        var result = await service.DeleteAsync(category.Id, CancellationToken.None);

        Assert.Equal(CategoryDeleteStatus.InUse, result);
    }

    [Fact]
    public async Task TransactionService_CreatesIncomeAndExpenseAndRejectsMissingCategory()
    {
        await using var db = CreateDbContext();
        var category = new Category("Salário");
        db.Categories.Add(category);
        await db.SaveChangesAsync();
        var service = new TransactionService(db);

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

    private static AlocaDbContext CreateDbContext() => new(
        new DbContextOptionsBuilder<AlocaDbContext>()
            .UseInMemoryDatabase($"aloca-tests-{Guid.NewGuid()}")
            .Options);
}
