namespace Aloca.Api.Services;

internal static class FinancialAllocationConcurrency
{
    // The database transaction protects separate application instances. The
    // process gate also serializes InMemory/tests and prevents two operations
    // sharing the same available balance inside this process.
    public static readonly SemaphoreSlim Gate = new(1, 1);
}

internal static class FinancialDomainErrors
{
    public static InvalidOperationException InsufficientBalance(decimal requested, decimal available)
    {
        var error = new InvalidOperationException("Saldo não alocado insuficiente para esta reserva.");
        error.Data["httpStatus"] = 409;
        return error;
    }

    public static InvalidOperationException InvalidAllocation(string message)
    {
        var error = new InvalidOperationException(message);
        error.Data["httpStatus"] = 422;
        return error;
    }
}
