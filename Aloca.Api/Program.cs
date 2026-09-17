using Aloca.Api.Data;
using Aloca.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not configured.");

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddDbContext<AlocaDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<TransactionService>();
builder.Services.AddScoped<FinancialSummaryService>(serviceProvider =>
    new FinancialSummaryService(serviceProvider.GetRequiredService<FinancialBalanceService>()));
builder.Services.AddScoped<FinancialBalanceService>();
builder.Services.AddScoped<FinancialCommitmentService>();
builder.Services.AddScoped<FinancialAllocationService>();
builder.Services.AddScoped<FinancialSettingsService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
