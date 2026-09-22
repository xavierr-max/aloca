using Aloca.Api.Data;
using Aloca.Api.DTOs;
using Aloca.Api.Models;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Tests;

public sealed class TenantIsolationSecurityTests
{
    [Fact]
    public async Task SecondAccountCannotReadOrMutateFirstAccountsResources()
    {
        var databaseName = $"tenant-isolation-{Guid.NewGuid()}";
        var accountA = new Account("Conta A");
        var accountB = new Account("Conta B");
        await using (var seed = CreateDb(databaseName))
        {
            seed.Accounts.AddRange(accountA, accountB);
            await seed.SaveChangesAsync();
        }

        Guid categoryId;
        Guid transactionId;
        Guid commitmentId;
        Guid recurringId;
        Guid occurrenceId;
        await using (var dbA = CreateDb(databaseName, accountA.Id))
        {
            var category = new Category("Privada A");
            var transaction = new Transaction("Entrada A", 500m, TransactionType.Income, DateOnly.FromDateTime(DateTime.UtcNow), category.Id);
            var commitment = new FinancialCommitment("Compromisso A", 100m, 1, 0, 0m, 1, true);
            var recurring = new RecurringIncome("Recorrente A", 75m, category.Id, RecurringIncomeFrequency.Once, DateOnly.FromDateTime(DateTime.UtcNow), null, null);
            dbA.AddRange(category, transaction, commitment, recurring);
            await dbA.SaveChangesAsync();
            var recurringService = new RecurringIncomeService(dbA);
            var projected = await recurringService.GetAsync(recurring.Id, default);
            categoryId = category.Id;
            transactionId = transaction.Id;
            commitmentId = commitment.Id;
            recurringId = recurring.Id;
            occurrenceId = projected!.Occurrences.Single().Id;
        }

        await using var dbB = CreateDb(databaseName, accountB.Id);
        var categories = new CategoryService(dbB);
        var transactions = new TransactionService(dbB);
        var commitments = new FinancialCommitmentService(dbB, new FinancialBalanceService(dbB));
        var recurringServiceB = new RecurringIncomeService(dbB);

        Assert.Null(await categories.GetByIdAsync(categoryId, default));
        Assert.Equal(CategoryUpdateStatus.NotFound, (await categories.UpdateAsync(categoryId, "Invadida", default)).Status);
        Assert.Equal(CategoryDeleteStatus.NotFound, await categories.DeleteAsync(categoryId, default));

        Assert.Null(await transactions.GetByIdAsync(transactionId, default));
        Assert.Equal(TransactionWriteStatus.NotFound, (await transactions.UpdateAsync(transactionId, new TransactionRequest
        {
            Description = "Invadida", Amount = 1m, Type = TransactionType.Income,
            Date = DateOnly.FromDateTime(DateTime.UtcNow)
        }, default)).Status);
        Assert.False(await transactions.DeleteAsync(transactionId, default));

        Assert.Null(await commitments.GetByIdAsync(commitmentId, default));
        Assert.Null(await commitments.UpdateAsync(commitmentId,
            new FinancialCommitmentUpdateRequest("Invadido", 100m, 1, 1, true), default));
        Assert.False(await commitments.DeleteAsync(commitmentId, default));
        Assert.Null(await commitments.AllocateAsync(commitmentId, 10m, default));
        Assert.Null(await commitments.RegisterPaymentAsync(commitmentId, default));
        Assert.Null(await commitments.ReverseLatestPaymentAsync(commitmentId, default));

        Assert.Null(await recurringServiceB.GetAsync(recurringId, default));
        Assert.Null(await recurringServiceB.UpdateAsync(recurringId, new RecurringIncomeRequest
        {
            Description = "Invadida", Amount = 75m, Frequency = RecurringIncomeFrequency.Once,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow)
        }, default));
        Assert.False(await recurringServiceB.DeleteAsync(recurringId, default));
        Assert.Null(await recurringServiceB.ReceiveAsync(occurrenceId, default));
    }

    private static AlocaDbContext CreateDb(string name, Guid? userId = null)
    {
        var accessor = new CurrentUserAccessor();
        accessor.Set(userId);
        return new AlocaDbContext(new DbContextOptionsBuilder<AlocaDbContext>().UseInMemoryDatabase(name).Options, accessor);
    }
}
