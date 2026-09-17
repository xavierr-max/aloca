# Aloca

Backend de uma aplicação de controle financeiro pessoal. O Aloca diferencia o saldo real baseado em movimentações do dinheiro virtualmente comprometido por compromissos financeiros. O saldo livre e a distribuição automática serão implementados em etapas posteriores.

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
- Docker Desktop;
- PostgreSQL 18 via Docker Compose.

## PostgreSQL local com Docker

O Compose usa a imagem oficial `postgres:18`, cria o container `aloca-postgres`, publica a porta `5432` e mantém os dados no volume `aloca_aloca_postgres_data`. O arquivo `.env` local é ignorado pelo Git; copie `.env.example` para `.env` e ajuste a senha quando necessário.

```powershell
Copy-Item .env.example .env
docker compose config
docker compose up -d
docker compose ps
```

Para a API executada diretamente no Windows, configure o User Secrets apontando para `localhost`:

```powershell
dotnet user-secrets set --project .\Aloca.Api "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=aloca;Username=aloca;Password=SUA_SENHA"
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

`appsettings.json` traz somente uma configuração local sem senha. Não registre credenciais em arquivos versionados. Se a API futuramente também rodar em Docker, o host será o nome do serviço Compose (por exemplo, `postgres`), não `localhost`: containers usam a rede interna do Compose; a API no Windows usa a porta publicada do host.

## Executando

Na raiz do repositório:

```powershell
dotnet restore .\aloca.slnx
dotnet tool restore
dotnet tool run dotnet-ef database update --project .\Aloca.Api --startup-project .\Aloca.Api
dotnet run --project .\Aloca.Api
```

Teste `http://localhost:5243/health` (ou a porta exibida pelo `dotnet run`). A documentação OpenAPI fica em `/openapi/v1.json` no ambiente de desenvolvimento.

## Modelo financeiro atual

- `Category`: categoria de uma movimentação.
- `Transaction`: entrada ou saída, sempre vinculada a uma categoria.
- `FinancialCommitment`: compromisso parcelado, recorrente ou futuro provisionado. `AllocatedAmount` é uma reserva virtual: continua compondo o saldo real, mas deixa de ser saldo livre.

As APIs atuais são `GET/POST/PUT/DELETE /api/categories`, `GET/POST/PUT/DELETE /api/transactions` (com filtros `type`, `categoryId`, `startDate`, `endDate`, `page` e `pageSize`) e `GET /api/financial-summary`. O resumo calcula apenas `totalIncome - totalExpense`; alocações ainda não são descontadas.

## Banco de dados e migrations

O `AlocaDbContext` concentra o modelo do banco. A migration inicial já foi aplicada no PostgreSQL local:

```powershell
dotnet tool restore
dotnet tool run dotnet-ef database update --project .\Aloca.Api --startup-project .\Aloca.Api
```

Para parar o banco sem apagar dados:

```powershell
docker compose down
```

Para remover deliberadamente os dados persistidos, use `docker compose down -v` e confirme que essa perda é desejada.
