namespace Aloca.Api.Models;

public sealed class FinancialCommitmentAllocationArchive
{
    private FinancialCommitmentAllocationArchive() { }
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid FinancialCommitmentId { get; private set; }
    public decimal HistoricalAllocatedAmount { get; private set; }
    public bool HistoricalFullyCommitted { get; private set; }
    public DateTime ArchivedAt { get; private set; }
}
