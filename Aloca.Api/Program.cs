using Aloca.Api.Data;
using Aloca.Api.Health;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using System.Threading.RateLimiting;
using System.Text.Json.Serialization;
using System.Diagnostics;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not configured.");

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        var requestId = context.HttpContext.TraceIdentifier;
        context.ProblemDetails.Extensions["requestId"] = requestId;
        context.ProblemDetails.Extensions.Remove("traceId");
    };
});
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks()
    .AddCheck<PostgresHealthCheck>("postgres", tags: new[] { "ready" });
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<IBusinessClock, SystemBusinessClock>();
builder.Services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();
var dataProtection = builder.Services.AddDataProtection()
    .SetApplicationName(builder.Configuration["DataProtection:ApplicationName"] ?? "Aloca");
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
{
    var resolvedKeysPath = Path.GetFullPath(dataProtectionKeysPath);
    Directory.CreateDirectory(resolvedKeysPath);
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(resolvedKeysPath));
}
builder.Services.AddAuthentication(AccountService.AuthScheme)
    .AddCookie(AccountService.AuthScheme, options =>
    {
        options.Cookie.Name = AccountService.AuthScheme;
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        options.Cookie.IsEssential = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(14);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    var globalLimit = builder.Configuration.GetValue("RateLimiting:GlobalPermitLimit", 120);
    var accountLimit = builder.Configuration.GetValue("RateLimiting:AccountPermitLimit", 12);
    var heavyLimit = builder.Configuration.GetValue("RateLimiting:HeavyPermitLimit", 40);
    var windowSeconds = builder.Configuration.GetValue("RateLimiting:WindowSeconds", 60);
    var window = TimeSpan.FromSeconds(windowSeconds);

    static string ClientKey(HttpContext context)
    {
        var userId = context.RequestServices.GetRequiredService<ICurrentUserAccessor>().UserId;
        return userId.HasValue
            ? $"user:{userId.Value:N}"
            : $"ip:{context.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";
    }

    static FixedWindowRateLimiterOptions Options(int permitLimit, TimeSpan window) => new()
    {
        PermitLimit = permitLimit,
        Window = window,
        QueueLimit = 0,
        AutoReplenishment = true
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter($"global:{ClientKey(context)}", _ => Options(globalLimit, window)));
    options.AddPolicy("account", context =>
        RateLimitPartition.GetFixedWindowLimiter($"account:{ClientKey(context)}", _ => Options(accountLimit, window)));
    options.AddPolicy("heavy", context =>
        RateLimitPartition.GetFixedWindowLimiter($"heavy:{ClientKey(context)}", _ => Options(heavyLimit, window)));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers.RetryAfter = windowSeconds.ToString();
        await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context.HttpContext,
            ProblemDetails = new ProblemDetails
            {
                Status = StatusCodes.Status429TooManyRequests,
                Title = "Limite de requisições excedido",
                Detail = "Aguarde alguns instantes antes de tentar novamente."
            }
        });
    };
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (builder.Environment.IsDevelopment())
    {
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    }
    else
    {
        var trustedProxyNetwork = builder.Configuration["ForwardedHeaders:TrustedProxyNetwork"]
            ?? "172.30.0.0/24";
        var slash = trustedProxyNetwork.LastIndexOf('/');
        var address = IPAddress.Parse(trustedProxyNetwork[..slash]);
        var prefixLength = int.Parse(trustedProxyNetwork[(slash + 1)..]);
        options.KnownIPNetworks.Add(new System.Net.IPNetwork(address, prefixLength));
    }
});
builder.Services.AddDbContext<AlocaDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<TransactionService>();
builder.Services.AddScoped<RecurringIncomeService>();
builder.Services.AddScoped<FinancialSummaryService>();
builder.Services.AddScoped<FinancialBalanceService>();
builder.Services.AddHostedService<DeviceRetentionHostedService>();
builder.Services.AddScoped<FinancialAllocationReconciliationService>();
builder.Services.AddScoped<FinancialCommitmentService>();
builder.Services.AddScoped<FinancialSettingsService>();
builder.Services.AddScoped<IForecastEventNormalizer, ForecastEventNormalizer>();
builder.Services.AddScoped<IForecastCalculator, ForecastCalculator>();
builder.Services.AddScoped<IFinancialForecastService, FinancialForecastService>();
builder.Services.AddHostedService<AutomaticProcessingHostedService>();

var app = builder.Build();
var startupLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
startupLogger.LogInformation("Application startup started environment={Environment}", app.Environment.EnvironmentName);

app.UseForwardedHeaders();

app.Use(async (context, next) =>
{
    var requestId = context.Request.Headers["X-Request-Id"].FirstOrDefault();
    if (string.IsNullOrWhiteSpace(requestId) || requestId.Length > 128)
    {
        requestId = Guid.NewGuid().ToString("N");
    }

    context.TraceIdentifier = requestId;
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Request-Id"] = requestId;
        return Task.CompletedTask;
    });

    await next();
});

app.UseExceptionHandler();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AlocaDbContext>();
    var migrationCommand = args.Contains("--migrate", StringComparer.OrdinalIgnoreCase);
    try
    {
        if (migrationCommand)
        {
            if (dbContext.Database.IsRelational()) dbContext.Database.Migrate();
            else dbContext.Database.EnsureCreated();
        }
        else if (app.Environment.IsDevelopment())
        {
            if (dbContext.Database.IsRelational()) dbContext.Database.Migrate();
            else dbContext.Database.EnsureCreated();
        }
        startupLogger.LogInformation("Database startup check completed migration_requested={MigrationRequested}", migrationCommand);
    }
    catch (Exception ex)
    {
        startupLogger.LogCritical(ex, "Database unavailable during startup migration_requested={MigrationRequested}", migrationCommand);
        throw;
    }

    if (migrationCommand) return;
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseRouting();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseMiddleware<AccountSessionMiddleware>();
app.Use(async (context, next) =>
{
    var started = Stopwatch.GetTimestamp();

    try { await next(); }
    finally
    {
        var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        var userId = context.RequestServices.GetRequiredService<ICurrentUserAccessor>().UserId;
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("ApiRequests");
        var status = context.Response.StatusCode;
        if (status >= 500)
            logger.LogError("HTTP 5xx request_id={RequestId} endpoint={Endpoint} method={Method} user_id={UserId} status={Status} duration_ms={DurationMs}", context.TraceIdentifier, context.Request.Path, context.Request.Method, userId, status, Math.Round(elapsed));
        else
            logger.LogInformation("HTTP request_id={RequestId} endpoint={Endpoint} method={Method} user_id={UserId} status={Status} duration_ms={DurationMs}", context.TraceIdentifier, context.Request.Path, context.Request.Method, userId, status, Math.Round(elapsed));
    }
});
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
// Keep the existing endpoint as the readiness signal for existing probes.
app.MapHealthChecks("/health", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

app.Run();

public partial class Program;
