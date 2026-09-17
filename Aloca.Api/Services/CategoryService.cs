using Aloca.Api.Data;
using Aloca.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Aloca.Api.Services;

public enum CategoryUpdateStatus
{
    Success,
    NotFound,
    Duplicate
}

public enum CategoryDeleteStatus
{
    Deleted,
    NotFound,
    InUse
}

public sealed record CategoryUpdateResult(CategoryUpdateStatus Status, Category? Category);

public sealed class CategoryService(AlocaDbContext dbContext)
{
    public Task<List<Category>> GetAllAsync(CancellationToken cancellationToken) =>
        dbContext.Categories
            .AsNoTracking()
            .OrderBy(category => category.Name)
            .ToListAsync(cancellationToken);

    public Task<Category?> GetByIdAsync(Guid id, CancellationToken cancellationToken) =>
        dbContext.Categories
            .AsNoTracking()
            .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

    public async Task<Category?> CreateAsync(string name, CancellationToken cancellationToken)
    {
        var normalizedName = NormalizeName(name);
        var exists = await dbContext.Categories
            .AnyAsync(category => category.Name.ToUpper() == normalizedName, cancellationToken);

        if (exists)
        {
            return null;
        }

        var category = new Category(name);
        dbContext.Categories.Add(category);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return category;
        }
        catch (DbUpdateException)
        {
            return null;
        }
    }

    public async Task<CategoryUpdateResult> UpdateAsync(Guid id, string name, CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories
            .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

        if (category is null)
        {
            return new CategoryUpdateResult(CategoryUpdateStatus.NotFound, null);
        }

        var normalizedName = NormalizeName(name);
        var exists = await dbContext.Categories.AnyAsync(
            candidate => candidate.Id != id && candidate.Name.ToUpper() == normalizedName,
            cancellationToken);

        if (exists)
        {
            return new CategoryUpdateResult(CategoryUpdateStatus.Duplicate, null);
        }

        category.UpdateName(name);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            return new CategoryUpdateResult(CategoryUpdateStatus.Success, category);
        }
        catch (DbUpdateException)
        {
            return new CategoryUpdateResult(CategoryUpdateStatus.Duplicate, null);
        }
    }

    public async Task<CategoryDeleteStatus> DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var category = await dbContext.Categories
            .SingleOrDefaultAsync(category => category.Id == id, cancellationToken);

        if (category is null)
        {
            return CategoryDeleteStatus.NotFound;
        }

        var isInUse = await dbContext.Transactions
            .AnyAsync(transaction => transaction.CategoryId == id, cancellationToken);

        if (isInUse)
        {
            return CategoryDeleteStatus.InUse;
        }

        dbContext.Categories.Remove(category);
        await dbContext.SaveChangesAsync(cancellationToken);
        return CategoryDeleteStatus.Deleted;
    }

    private static string NormalizeName(string name) => name.Trim().ToUpperInvariant();
}
