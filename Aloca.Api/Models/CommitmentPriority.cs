namespace Aloca.Api.Models;

public enum CommitmentPriority
{
    High = 1,
    Medium = 2,
    Low = 3
}

public static class CommitmentPriorityExtensions
{
    public static string? Label(this int? priority) => priority switch
    {
        null => null,
        (int)CommitmentPriority.High => "Alta",
        (int)CommitmentPriority.Medium => "Média",
        (int)CommitmentPriority.Low => "Baixa",
        _ => "Indefinida"
    };
}
