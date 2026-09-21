using Aloca.Api.Data;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using System.Text.Json.Serialization;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not configured.");

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserAccessor, CurrentUserAccessor>();
var dataProtection = builder.Services.AddDataProtection();
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
        options.Cookie.SameSite = SameSiteMode.Lax;
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
    options.AddPolicy("account", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddDbContext<AlocaDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped<AccountService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<TransactionService>();
builder.Services.AddScoped<RecurringIncomeService>();
builder.Services.AddScoped<FinancialSummaryService>();
builder.Services.AddScoped<FinancialBalanceService>();
builder.Services.AddScoped<FinancialAllocationReconciliationService>();
builder.Services.AddScoped<FinancialCommitmentService>();
builder.Services.AddScoped<FinancialSettingsService>();
builder.Services.AddScoped<FinancialProjectionService>();
builder.Services.AddHostedService<AutomaticProcessingHostedService>();

var app = builder.Build();

app.UseForwardedHeaders();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AlocaDbContext>();
    dbContext.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<AccountSessionMiddleware>();
app.Use(async (context, next) =>
{
    var requestId = context.Request.Headers["X-Request-Id"].FirstOrDefault() ?? Guid.NewGuid().ToString("N");
    var started = Stopwatch.GetTimestamp();

    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Request-Id"] = requestId;
        return Task.CompletedTask;
    });

    try { await next(); }
    finally
    {
        var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
        var userId = context.RequestServices.GetRequiredService<ICurrentUserAccessor>().UserId;
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("ApiRequests");
        logger.LogInformation("request_id={RequestId} endpoint={Endpoint} method={Method} user_id={UserId} status={Status} duration_ms={DurationMs}", requestId, context.Request.Path, context.Request.Method, userId, context.Response.StatusCode, Math.Round(elapsed));
    }
});
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
