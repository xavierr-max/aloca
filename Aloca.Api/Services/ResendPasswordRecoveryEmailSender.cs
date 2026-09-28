using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net;
using System.Text.Json.Serialization;

namespace Aloca.Api.Services;

public sealed class ResendEmailOptions
{
    public string ApiKey { get; init; } = string.Empty;
    public string FromAddress { get; init; } = string.Empty;
    public string FromName { get; init; } = "Aloca";
    public string PublicFrontendUrl { get; init; } = string.Empty;
    public string Environment { get; init; } = string.Empty;
}

public sealed class EmailDeliveryException(string message, Exception? inner = null) : Exception(message, inner);

public sealed class ResendPasswordRecoveryEmailSender(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<ResendPasswordRecoveryEmailSender> logger)
    : IPasswordRecoveryEmailSender
{
    private const string CanonicalFrontendHost = "usealoca.tech";
    private const string ResendEndpoint = "emails";
    private readonly ResendEmailOptions options = new()
    {
        ApiKey = configuration["Email:Resend:ApiKey"] ?? string.Empty,
        FromAddress = configuration["Email:Resend:FromAddress"] ?? string.Empty,
        FromName = configuration["Email:Resend:FromName"] ?? "Aloca",
        PublicFrontendUrl = configuration["Email:PublicFrontendUrl"] ?? string.Empty,
        Environment = configuration["ASPNETCORE_ENVIRONMENT"] ?? configuration["Email:Environment"] ?? string.Empty
    };

    public async Task SendAsync(string recipientEmail, string rawToken, DateTime expiresAt, CancellationToken cancellationToken)
    {
        ValidateConfiguration();
        var resetUrl = BuildResetUrl(rawToken);
        var message = new ResendEmailRequest(
            $"{options.FromName} <{options.FromAddress}>",
            [recipientEmail],
            "Redefinição de senha — Aloca",
            PasswordRecoveryEmailTemplate.Html(resetUrl, expiresAt),
            PasswordRecoveryEmailTemplate.Text(resetUrl, expiresAt));

        using var request = new HttpRequestMessage(HttpMethod.Post, ResendEndpoint)
        {
            Content = JsonContent.Create(message)
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);

        try
        {
            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogError("Password recovery email provider returned status={StatusCode} environment={Environment}.",
                    (int)response.StatusCode, options.Environment);
                throw new EmailDeliveryException("O provedor de e-mail recusou a solicitação.");
            }
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogError("Password recovery email provider timed out environment={Environment}.", options.Environment);
            throw new EmailDeliveryException("O provedor de e-mail não respondeu a tempo.");
        }
        catch (HttpRequestException ex)
        {
            logger.LogError(ex, "Password recovery email provider request failed environment={Environment}.", options.Environment);
            throw new EmailDeliveryException("Não foi possível contactar o provedor de e-mail.", ex);
        }
    }

    private void ValidateConfiguration()
    {
        if (string.IsNullOrWhiteSpace(options.ApiKey)
            || string.IsNullOrWhiteSpace(options.FromAddress)
            || string.IsNullOrWhiteSpace(options.PublicFrontendUrl))
        {
            logger.LogError("Password recovery email sender is not configured for environment={Environment}.", options.Environment);
            throw new EmailDeliveryException("O envio de e-mail não está configurado.");
        }

        if (!Uri.TryCreate(options.PublicFrontendUrl, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || (!string.Equals(options.Environment, "Development", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(uri.Host, CanonicalFrontendHost, StringComparison.OrdinalIgnoreCase)))
        {
            logger.LogError("Password recovery email sender has an invalid public frontend URL for environment={Environment}.", options.Environment);
            throw new EmailDeliveryException("A URL pública do frontend não é válida para o ambiente.");
        }
    }

    private string BuildResetUrl(string rawToken)
    {
        var baseUrl = options.PublicFrontendUrl.TrimEnd('/');
        return $"{baseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}";
    }
}

public sealed record ResendEmailRequest(
    [property: JsonPropertyName("from")] string From,
    [property: JsonPropertyName("to")] IReadOnlyCollection<string> To,
    [property: JsonPropertyName("subject")] string Subject,
    [property: JsonPropertyName("html")] string Html,
    [property: JsonPropertyName("text")] string Text);

public static class PasswordRecoveryEmailTemplate
{
    public static string Html(string resetUrl, DateTime expiresAt) => $"""
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redefinição de senha — Aloca</title></head>
<body style="margin:0;background:#f1f5f2;color:#18231e;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f1f5f2">
    <tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;padding:36px 32px">
      <tr><td><div style="font-size:24px;font-weight:700;color:#238653">Aloca</div>
      <h1 style="font-size:24px;margin:28px 0 16px">Redefinição de senha</h1>
      <p>Olá!</p><p>Recebemos uma solicitação para redefinir a senha da sua conta Aloca.</p>
      <p>Clique no botão abaixo para criar uma nova senha.</p>
      <p style="margin:28px 0"><a href="{WebUtility.HtmlEncode(resetUrl)}" style="display:inline-block;background:#39a96b;color:#10251c;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">Redefinir minha senha</a></p>
      <p style="font-size:14px;color:#63726e">O botão não funcionou?</p>
      <p style="font-size:14px;color:#63726e">Copie e cole o endereço abaixo no seu navegador:</p>
      <p style="font-size:14px;overflow-wrap:anywhere;word-break:break-word"><a href="{WebUtility.HtmlEncode(resetUrl)}" style="color:#238653;overflow-wrap:anywhere;word-break:break-word">{WebUtility.HtmlEncode(resetUrl)}</a></p>
      <p style="font-size:14px;color:#63726e">Este link expira em 30 minutos e só pode ser utilizado uma vez.</p>
      <p style="font-size:14px;color:#63726e">Se você não solicitou essa alteração, ignore esta mensagem.</p>
      <p>Equipe Aloca.</p></td></tr>
    </table></td></tr>
  </table>
</body></html>
""";

    public static string Text(string resetUrl, DateTime expiresAt) => $"""
Aloca — Redefinição de senha

Olá!

Recebemos uma solicitação para redefinir a senha da sua conta Aloca.

Abra o link abaixo para criar uma nova senha:
{resetUrl}

Este link expira em 30 minutos e só pode ser utilizado uma vez.

Se você não solicitou essa alteração, ignore esta mensagem.

Equipe Aloca.
""";
}
