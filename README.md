# Aloca

Backend inicial de uma aplicação de controle financeiro pessoal. O objetivo futuro é diferenciar o saldo total, os valores virtualmente comprometidos e o saldo livre para gastar, incluindo compromissos financeiros e compras parceladas. Nesta etapa não há entidades ou regras financeiras implementadas.

## Stack

- .NET 10 / ASP.NET Core Web API com C#;
- Entity Framework Core 10;
- PostgreSQL com provider Npgsql;
- OpenAPI nativo do ASP.NET Core.

## Estrutura atual

```text
aloca.slnx
Aloca.Api/
├── Controllers/     # endpoints REST futuros
├── Data/            # DbContext, configurações EF Core e migrations
├── DTOs/            # contratos HTTP futuros
├── Models/          # entidades de domínio futuras
└── Services/        # regras de aplicação futuras
```

O endpoint `GET /health` confirma que a API está em execução. Em ambiente de desenvolvimento, o documento OpenAPI fica disponível em `/openapi/v1.json`.

## Pré-requisitos

- .NET SDK 10;
- PostgreSQL em execução (localmente ou em container).

## Configurando o PostgreSQL

Crie um banco local chamado `aloca` e defina a senha fora do repositório, usando User Secrets:

```powershell
dotnet user-secrets set --project .\Aloca.Api "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=aloca;Username=postgres;Password=SUA_SENHA"
```

Nesta máquina clonada, execute esse comando novamente com a senha real do PostgreSQL. O projeto possui `UserSecretsId` configurado e o ASP.NET Core carrega User Secrets automaticamente no ambiente `Development`, sobrescrevendo a connection string sem gravá-la no Git. Confirme o cadastro com:

```powershell
dotnet user-secrets list --project .\Aloca.Api
```

Se preferir usar o PostgreSQL do Compose, copie `.env.example` para `.env`, substitua `replace_with_a_local_development_password` por uma senha local e inicie o serviço:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
```

Depois cadastre no User Secrets a mesma senha usada no `.env`:

```powershell
dotnet user-secrets set --project .\Aloca.Api "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=aloca;Username=postgres;Password=SUA_SENHA"
```

Em servidores ou containers, use a variável de ambiente equivalente:

```text
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=aloca;Username=...;Password=...
```

`appsettings.json` traz somente uma configuração local sem senha. Não registre credenciais em arquivos versionados.

## Executando

Na raiz do repositório:

```powershell
dotnet restore .\aloca.slnx
dotnet run --project .\Aloca.Api
```

Teste a disponibilidade em `http://localhost:5243/health` (ou na porta exibida pelo `dotnet run`).

## Modelo financeiro atual

- `Category`: categoria de uma movimentação.
- `Transaction`: entrada ou saída, sempre vinculada a uma categoria.
- `FinancialCommitment`: compromisso parcelado, recorrente ou futuro provisionado. `AllocatedAmount` é uma reserva virtual: continua compondo o saldo real, mas deixa de ser saldo livre. Os valores de cobertura e parcelas garantidas são cálculos do domínio, não colunas no banco.

## Banco de dados e migrations

O `AlocaDbContext` concentra o modelo do banco. A migration inicial já está no projeto e deve ser aplicada somente depois que a connection string estiver configurada:

```powershell
dotnet tool restore
dotnet tool run dotnet-ef database update --project .\Aloca.Api --startup-project .\Aloca.Api
```
