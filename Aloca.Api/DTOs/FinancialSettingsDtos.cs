using System.ComponentModel.DataAnnotations;

namespace Aloca.Api.DTOs;

public sealed record FinancialSettingsRequest(
    [param: Range(typeof(decimal), "0", "9999999999999999.99")] decimal InitialBalance);

public sealed record FinancialSettingsResponse(decimal InitialBalance);
