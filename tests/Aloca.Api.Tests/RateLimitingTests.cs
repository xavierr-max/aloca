using System.Net;
using System.Net.Http.Json;
using Aloca.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Aloca.Api.Tests;

public sealed class RateLimitingTests : IClassFixture<RateLimitingApplicationFactory>
{
    private readonly RateLimitingApplicationFactory factory;

    public RateLimitingTests(RateLimitingApplicationFactory factory) => this.factory = factory;

    [Fact]
    public async Task NormalRequestIsAllowedAndRepeatedAbuseGets429()
    {
        using var client = factory.CreateClient();

        var first = await client.GetAsync("/api/account/current");
        var second = await client.GetAsync("/api/account/current");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
        Assert.Equal("60", second.Headers.RetryAfter?.Delta?.TotalSeconds.ToString("0"));
    }

    [Fact]
    public async Task IdentifiedUsersUseDifferentGlobalBuckets()
    {
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();

        var first = await firstClient.GetAsync("/api/account/current");
        var second = await secondClient.GetAsync("/api/account/current");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
    }

    [Fact]
    public async Task PasswordRecoveryUsesThePublicRateLimit()
    {
        using var client = factory.CreateClient();

        var first = await client.PostAsJsonAsync("/api/account/password-recovery/request", new { email = "pessoa@example.com" });
        var second = await client.PostAsJsonAsync("/api/account/password-recovery/request", new { email = "pessoa@example.com" });

        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
    }
}

public sealed class RateLimitingApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["RateLimiting:GlobalPermitLimit"] = "1",
            ["RateLimiting:AccountPermitLimit"] = "1",
            ["RateLimiting:HeavyPermitLimit"] = "1",
            ["RateLimiting:WindowSeconds"] = "60"
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AlocaDbContext>>();
            services.RemoveAll<DbContextOptions>();
            foreach (var descriptor in services
                .Where(service => service.ServiceType.FullName?.Contains("IDbContextOptionsConfiguration") == true)
                .ToList())
            {
                services.Remove(descriptor);
            }
            services.AddDbContext<AlocaDbContext>(options => options.UseInMemoryDatabase("rate-limit-tests"));
        });
    }
}
