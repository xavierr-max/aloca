using System.Net;
using System.Text.Json;
using Aloca.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Aloca.Api.Tests;

public sealed class ResendPasswordRecoveryEmailSenderTests
{
    [Fact]
    public async Task SendsHtmlAndTextMessageToResendWithoutDuplicatingRequest()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var sender = CreateSender(handler);

        await sender.SendAsync("pessoa@example.com", "ABC123", new DateTime(2026, 9, 26, 12, 30, 0, DateTimeKind.Utc), default);

        Assert.Equal(1, handler.CallCount);
        Assert.Equal("Bearer test-api-key", handler.Authorization);
        using var body = JsonDocument.Parse(handler.Body!);
        Assert.Equal("Redefinição de senha — Aloca", body.RootElement.GetProperty("subject").GetString());
        Assert.Contains("ABC123", body.RootElement.GetProperty("html").GetString());
        Assert.Contains("ABC123", body.RootElement.GetProperty("text").GetString());
        Assert.Contains("30 minutos", body.RootElement.GetProperty("html").GetString());
        Assert.Contains("reset-password?token=ABC123", body.RootElement.GetProperty("html").GetString());
    }

    [Fact]
    public async Task RejectsProviderHttpErrorsWithoutExposingProviderBody()
    {
        var handler = new RecordingHandler(HttpStatusCode.Unauthorized) { ResponseBody = "secret provider detail" };
        var sender = CreateSender(handler);

        var error = await Assert.ThrowsAsync<EmailDeliveryException>(() => sender.SendAsync("pessoa@example.com", "ABC123", DateTime.UtcNow.AddMinutes(30), default));

        Assert.Equal("O provedor de e-mail recusou a solicitação.", error.Message);
        Assert.DoesNotContain("secret provider detail", error.ToString());
    }

    [Fact]
    public async Task ConvertsTimeoutIntoOperationalError()
    {
        var handler = new RecordingHandler { ThrowTimeout = true };
        var sender = CreateSender(handler);

        var error = await Assert.ThrowsAsync<EmailDeliveryException>(() => sender.SendAsync("pessoa@example.com", "ABC123", DateTime.UtcNow.AddMinutes(30), default));

        Assert.Equal("O provedor de e-mail não respondeu a tempo.", error.Message);
    }

    [Fact]
    public async Task MissingConfigurationFailsWithoutMakingHttpRequest()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:Environment"] = "Production",
            ["Email:PublicFrontendUrl"] = "https://app.example.com",
            ["Email:Resend:FromAddress"] = "noreply@example.com"
        }).Build();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com/") };
        var sender = new ResendPasswordRecoveryEmailSender(client, configuration, NullLogger<ResendPasswordRecoveryEmailSender>.Instance);

        await Assert.ThrowsAsync<EmailDeliveryException>(() => sender.SendAsync("pessoa@example.com", "ABC123", DateTime.UtcNow.AddMinutes(30), default));
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task ProductionRejectsNonHttpsPublicFrontendUrl()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);
        var sender = CreateSender(handler, environment: "Production", frontendUrl: "http://app.example.com");

        await Assert.ThrowsAsync<EmailDeliveryException>(() => sender.SendAsync("pessoa@example.com", "ABC123", DateTime.UtcNow.AddMinutes(30), default));
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public void TemplateDoesNotContainExternalDependencies()
    {
        var html = PasswordRecoveryEmailTemplate.Html("https://app.example.com/reset-password?token=ABC123", DateTime.UtcNow.AddMinutes(30));

        Assert.DoesNotContain("http://", html);
        Assert.DoesNotContain("fonts.googleapis", html);
        Assert.Contains("Redefinir minha senha", html);
    }

    private static ResendPasswordRecoveryEmailSender CreateSender(
        RecordingHandler handler,
        string environment = "Production",
        string frontendUrl = "https://app.example.com")
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:Environment"] = environment,
            ["Email:PublicFrontendUrl"] = frontendUrl,
            ["Email:Resend:ApiKey"] = "test-api-key",
            ["Email:Resend:FromAddress"] = "noreply@example.com",
            ["Email:Resend:FromName"] = "Aloca"
        }).Build();
        var client = new HttpClient(handler) { BaseAddress = new Uri("https://api.resend.com/") };
        return new ResendPasswordRecoveryEmailSender(client, configuration, NullLogger<ResendPasswordRecoveryEmailSender>.Instance);
    }

    private sealed class RecordingHandler(HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public int CallCount { get; private set; }
        public string? Authorization { get; private set; }
        public string? Body { get; private set; }
        public string? ResponseBody { get; set; }
        public bool ThrowTimeout { get; set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            CallCount++;
            Authorization = request.Headers.Authorization?.ToString();
            Body = await request.Content!.ReadAsStringAsync(cancellationToken);
            if (ThrowTimeout) throw new TaskCanceledException("simulated timeout");
            return new HttpResponseMessage(status) { Content = new StringContent(ResponseBody ?? "{}") };
        }
    }
}
