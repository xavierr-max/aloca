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

Os endpoints `GET /health/live` e `GET /health/ready` expõem, respectivamente, liveness do processo e readiness com conexão ao PostgreSQL. `/health` permanece como alias de readiness. Em ambiente de desenvolvimento, o documento OpenAPI fica disponível em `/openapi/v1.json`.

## Pré-requisitos

- .NET SDK 10;
- Docker Desktop;
- PostgreSQL 18 via Docker Compose.

## PostgreSQL local com Docker

O Compose padrão é destinado ao desenvolvimento: usa a imagem oficial `postgres:18`, publica a porta `5432` para a API executada diretamente na máquina e mantém os dados em volume. O arquivo `.env` local é ignorado pelo Git; copie `.env.example` para `.env` e ajuste a senha quando necessário.

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

## Contas e isolamento

O primeiro acesso usa o middleware de sessão para criar ou recuperar uma conta local no mesmo dispositivo e autenticá-la por cookie. A conta é uma entidade persistente; proteger a conta preenche e-mail e `PasswordHash` na mesma linha e preserva o `Id` e os dados financeiros. O login de contas protegidas utiliza e-mail e senha.

O cookie `aloca.device` contém somente um token aleatório bruto no navegador; o banco guarda apenas seu hash em `devices`. O cookie `aloca.auth` é um cookie ASP.NET Core protegido por Data Protection, com validade de 14 dias e verificação de `SecurityStamp`/`SessionVersion` a cada request. As chaves de Data Protection ficam em `DataProtection:KeysPath`, que deve apontar para um volume persistente em produção.

Cada registro financeiro possui `UserId`, filtro global do EF Core e FK para `accounts`. O limite de quatro contas é contado em `device_accounts` e validado no backend. Os endpoints de conta ficam em `/api/account/current`, `/api/account/local`, `/api/account/local/continue`, `/api/account/login`, `/api/account/protect`, `/api/account/rename`, `/api/account/password`, `/api/account/switch/{id}`, `/api/account/device` e `/api/account/current` (exclusão).

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

## Produção com Docker

O arquivo `compose.production.yml` publica somente o frontend na porta HTTP configurada por `HTTP_PORT`. A API e o PostgreSQL ficam na rede interna `backend`; o PostgreSQL não possui porta publicada. O Nginx serve os assets gerados pelo Vite e encaminha `/api` e `/health` para a API.

Crie o secret fora do Git e inicie a composição:

```bash
mkdir -p secrets
openssl rand -base64 32 > secrets/postgres_password.txt
POSTGRES_DB=aloca POSTGRES_USER=aloca docker compose -f compose.production.yml up -d --build
```

O arquivo `secrets/postgres_password.txt` e o diretório `secrets/` são ignorados pelo Git. Para usar outro caminho, defina `POSTGRES_PASSWORD_FILE` no ambiente antes de executar o Compose.

O Compose de produção monta o volume nomeado `aloca_data_protection_keys` em `/app/data-protection-keys`, com o caminho configurado por `DataProtection__KeysPath` (variável `DATA_PROTECTION_KEYS_PATH`, cujo padrão é `/app/data-protection-keys`). A aplicação usa `Aloca` como application name estável e o entrypoint aplica `umask 077`; o diretório é criado com permissão `0700`. As chaves não são copiadas para a imagem e `Aloca.Api/data-protection-keys/` permanece ignorado pelo Git. Preserve esse volume em todo redeploy para manter cookies existentes válidos.

Em produção, forneça um certificado válido em `secrets/tls/fullchain.pem` e sua chave privada em `secrets/tls/privkey.pem` (ou use `TLS_CERTIFICATE_DIR` para outro diretório). O Nginx termina TLS em `443` e redireciona todo HTTP de `80` para HTTPS; o caminho `/.well-known/acme-challenge/` permanece disponível para validação ACME.

A aplicação confia em `X-Forwarded-For` e `X-Forwarded-Proto` somente no subnet fixo `172.30.0.0/24` da rede interna do Nginx. O Nginx substitui os headers encaminhados pelo cliente, preservando o IP real em `X-Forwarded-For` e o protocolo original em `X-Forwarded-Proto`. Em desenvolvimento, a configuração continua compatível com o Vite e com a API local.

Na VPS, mantenha abertas apenas as portas `80/tcp` e `443/tcp`. SSH (`22/tcp`) deve ser permitido somente quando necessário, idealmente restrito aos IPs administrativos. A porta `5432/tcp` nunca deve ser aberta publicamente; a API também não possui porta publicada.

## Migrations e rollback em produção

A API não executa migrations automaticamente quando `ASPNETCORE_ENVIRONMENT=Production`. O startup local continua aplicando migrations para facilitar o desenvolvimento. Em produção, `--migrate` é um comando explícito e termina depois de aplicar as migrations pendentes.

O deploy deve ser executado nesta ordem, com apenas um operador ou job autorizado:

```bash
# 1. Backup antes de alterar o schema
mkdir -p backups
docker compose -f compose.production.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-aloca}" -d "${POSTGRES_DB:-aloca}" --format=custom \
  > "backups/aloca-$(date +%Y%m%d-%H%M%S).dump"

# 2. Construir a versão e executar a migration uma única vez
docker compose -f compose.production.yml build api frontend
./scripts/migrate-production.sh

# 3. Iniciar a nova versão
docker compose -f compose.production.yml up -d api frontend

# 4. Validar a aplicação pelo proxy
curl --fail --silent --show-error https://SEU_DOMINIO/health
```

O script `scripts/migrate-production.sh` usa `flock` para impedir duas migrations concorrentes no mesmo host. A tabela `__EFMigrationsHistory` também mantém o registro das migrations aplicadas, mas não substitui o lock do deploy. Não execute `dotnet ef database update` em paralelo com esse job.

## Smoke test após cada release

`scripts/smoke-test.sh` valida o deploy pelo endpoint público HTTPS. A suíte verifica health/readiness do PostgreSQL, HTTPS e headers de segurança, criação/login/logout, cookies e sessão, isolamento entre duas contas, grupos, entrada, saída, compromisso, alocação, pagamento e reversão, recorrência, recebimento idempotente, pausa/reativação e a configuração usada pelo processamento automático.

Como a suíte cria dados, ela exige confirmação explícita do ambiente. Use uma conta/dispositivo de smoke dedicado em staging, canary ou em um ambiente de teste da produção; nunca aponte para uma base de produção real sem essa autorização operacional:

```bash
SMOKE_BASE_URL=https://staging.exemplo.com \
SMOKE_ENV=staging \
SMOKE_ALLOW_MUTATIONS=1 \
./scripts/smoke-test.sh
```

O script requer `curl` e `jq`, usa dois jars de cookie temporários e nomes com timestamp. O teste não recebe credenciais existentes, não consulta o banco diretamente e falha antes de executar qualquer mutação se `SMOKE_ALLOW_MUTATIONS=1` não estiver definido. Para um ambiente formalmente destinado a testes de produção, use `SMOKE_ENV=production-test`; a proteção adicional para o valor literal `production` só pode ser removida com `SMOKE_ALLOW_PRODUCTION=1`.

Após `docker compose -f compose.production.yml up -d api frontend`, execute a suíte através do domínio configurado. Um resultado `PASS` é o critério de smoke aprovado; qualquer `FAIL` deve interromper a promoção e ser investigado pelos logs usando o `X-Request-Id` da requisição. O worker automático roda a cada minuto, portanto o smoke valida que o compromisso/recorrência foram criados com processamento automático habilitado e que os endpoints continuam disponíveis; a confirmação temporal do worker deve ser feita pelos logs da API e pelos dados do ambiente de teste.

O procedimento completo de rollback, incluindo identificação da tag anterior, rollback somente da aplicação, restore protegido e plano para falha do restore, está em [docs/PRODUCTION-ROLLBACK.md](docs/PRODUCTION-ROLLBACK.md). Não execute `database update` cegamente: migrations destrutivas ou incompatíveis exigem avaliação e, quando necessário, restauração do backup.

Migrations existentes permanecem versionadas em `Aloca.Api/Data/Migrations`; nenhuma migration ou banco foi removido ou recriado.

## Backup e restauração do PostgreSQL

O script [scripts/backup-postgres.sh](scripts/backup-postgres.sh) executa `pg_dump` dentro do container do PostgreSQL e grava dumps custom format comprimidos fora do volume do banco. O arquivo é escrito como `.part`, validado com `pg_restore --list` e renomeado somente depois da validação. Também é criado um checksum SHA-256, há log de sucesso ou falha e a retenção padrão é de 14 dias. A limpeza considera somente arquivos diretamente em `BACKUP_DIR` com o padrão `aloca-postgres-YYYYMMDD-HHMMSS.dump`, remove o checksum junto e preserva sempre o dump mais recente.

Variáveis opcionais:

- `COMPOSE_FILE`: Compose usado, padrão `compose.production.yml`;
- `BACKUP_DIR`: diretório dos dumps, padrão `backups/postgres`;
- `BACKUP_RETENTION_DAYS`: retenção em dias, padrão `14`;
- `BACKUP_LOG_FILE`: log do script, padrão `BACKUP_DIR/backup.log`; registra apenas metadados e resultados.

A senha não fica no script: o comando lê `/run/secrets/postgres_password`, montado pelo Compose. O diretório de backups recebe `0700` e dumps/checksums recebem `0600`; conceda acesso somente ao operador autorizado de backup/restore e administradores de infraestrutura. Como os dumps podem conter e-mails, hashes de credenciais, dados de conta e informações financeiras, mantenha uma segunda cópia em armazenamento externo com criptografia em trânsito e em repouso.

Para agendar diariamente às 02:15 UTC, copie [scripts/backup-postgres.cron.example](scripts/backup-postgres.cron.example) para o crontab do usuário responsável, ajustando `/opt/aloca` para o diretório real:

```bash
crontab -e
```

Backup manual:

```bash
./scripts/backup-postgres.sh
```

Restore seguro para um banco separado (padrão `aloca_restore_test`):

```bash
RESTORE_DATABASE=aloca_restore_test \
  ./scripts/restore-postgres.sh backups/postgres/aloca-postgres-AAAAMMDD-HHMMSS.dump
```

Esse procedimento recria somente o banco de destino e nunca substitui o banco de produção por padrão. Depois, valide a restauração listando tabelas ou apontando temporariamente uma API de teste para esse banco:

```bash
docker compose -f compose.production.yml exec -T postgres sh -ceu \
  'export PGPASSWORD="$(cat /run/secrets/postgres_password)"; \
   psql -U "$POSTGRES_USER" -d aloca_restore_test -c "SELECT count(*) FROM \"__EFMigrationsHistory\";"'
```

O script também verifica o checksum quando o arquivo `.sha256` está disponível. Para restaurar produção, pare a API, confirme o backup correto e defina explicitamente `RESTORE_DATABASE` para o banco de produção e `ALLOW_PRODUCTION_RESTORE=yes`; prefira sempre testar primeiro no banco separado.

## Logs e alertas operacionais

A API usa os providers padrão do `ILogger` do ASP.NET Core. Os eventos são emitidos com propriedades estruturadas, incluindo `request_id` e IDs de entidade quando aplicável; a coleta pode ser feita pelo stdout do container ou pelo provider de logging do ambiente, sem exigir OpenTelemetry ou Serilog. O middleware de requisições registra respostas 5xx em nível `Error`, e `/health/ready` verifica o PostgreSQL.

Os eventos relevantes são `Application startup started`, `Database unavailable`, `HTTP 5xx`, `Automatic processing started/completed/failed`, `Payment registered`, `Payment reversed`, `Transaction created/changed/deleted`, `Commitment created/changed/deleted` e `backup.started/completed/failed`. O backup grava JSON Lines em `BACKUP_LOG_FILE`, por padrão dentro de `BACKUP_DIR`; configure esse diretório em armazenamento persistente ou encaminhe o arquivo para o coletor do host.

Gere alertas para qualquer HTTP 5xx e aumento sustentado de 5xx, indisponibilidade do banco ou readiness não saudável, falha no processamento automático, falha no backup ou ausência de `backup.completed` no intervalo esperado. Pagamentos, reversões, exclusões e alterações de compromissos devem ser mantidos para auditoria e investigação, mas não precisam gerar alerta individual.

Os logs não incluem senha, hash, cookie, token, connection string ou valores financeiros completos.

## Rate limiting

Os limites ficam centralizados em `Aloca.Api/appsettings.json` e podem ser sobrescritos por configuração do ambiente: `GlobalPermitLimit=120`, `AccountPermitLimit=12`, `HeavyPermitLimit=40` e `WindowSeconds=60`. O limite global usa o usuário autenticado quando disponível e o IP já processado pelos `ForwardedHeaders` como fallback. Login, senha e operações de conta usam a política `account`; projeções usam `heavy`. Quando excedido, a API retorna `429`, Problem Details e `Retry-After`.

### Data e timezone de negócio

Datas financeiras usam a timezone configurada em `Business:TimeZone` (variável `BUSINESS_TIME_ZONE` no Compose de produção), com padrão `America/Sao_Paulo`. A API converte o relógio UTC para essa timezone uma única vez por meio de `IBusinessClock`; projeções, recorrências, primeira cobrança e processamento automático usam o mesmo `Today`. Timestamps técnicos permanecem em UTC.

Para testar viradas de meia-noite, mês e ano, injete uma implementação fixa de `IBusinessClock` nos testes. Não use `DateTime.UtcNow` diretamente para decidir datas financeiras.

### Testes de integração PostgreSQL

Os testes unitários continuam usando InMemory. Para validar migrations, tipos, constraints, foreign keys, cascatas e transações em PostgreSQL real, execute `./scripts/test-postgres-integration.sh`. O script cria um container descartável `postgres:18`, aplica todas as migrations em banco vazio, executa `PostgresIntegrationTests` e remove o container. Para apontar para um PostgreSQL já disponível, defina `ALOCA_TEST_POSTGRES_CONNECTION` e execute `dotnet test tests/Aloca.Api.Tests/Aloca.Api.Tests.csproj --filter FullyQualifiedName~PostgresIntegrationTests`.
