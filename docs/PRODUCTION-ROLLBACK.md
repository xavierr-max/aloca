# Rollback de produção

Procedimento para `compose.production.yml`, ASP.NET Core, EF Core e PostgreSQL. O rollback da aplicação mantém o schema; o rollback com banco restaura o backup anterior.

## Pré-requisitos

Tenha acesso ao host, Docker Compose e `flock`; o secret `secrets/postgres_password.txt`; TLS; espaço para backups; a imagem anterior da API e do frontend preservada por tag imutável ou digest; e uma conta dedicada para smoke test.

O Compose usa `aloca-api:production` e `aloca-frontend:production` por padrão. Em produção, prefira tags imutáveis via `ALOCA_API_IMAGE` e `ALOCA_FRONTEND_IMAGE`. Registre as imagens antes de substituí-las:

```bash
docker inspect --format '{{.Config.Image}}' "$(docker compose -f compose.production.yml ps -q api)"
docker inspect --format '{{.Config.Image}}' "$(docker compose -f compose.production.yml ps -q frontend)"
```

Nunca reconstrua uma versão antiga com o checkout atual.

## Estado atual e migration

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml exec -T postgres sh -ceu \
  'export PGPASSWORD="$(cat /run/secrets/postgres_password)"; psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT \"MigrationId\", \"ProductVersion\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";"'
```

A última linha identifica a migration aplicada. Compare-a com `Aloca.Api/Data/Migrations` e com a versão da imagem anterior.

## Deploy

```bash
export ALOCA_API_IMAGE="registry.example/aloca-api:TAG_NOVA"
export ALOCA_FRONTEND_IMAGE="registry.example/aloca-frontend:TAG_NOVA"
docker compose -f compose.production.yml pull api frontend
./scripts/backup-postgres.sh
docker compose -f compose.production.yml run --rm api --migrate
docker compose -f compose.production.yml up -d --no-build api frontend
curl --fail --silent --show-error https://SEU_DOMINIO/health
SMOKE_BASE_URL=https://SEU_DOMINIO SMOKE_ENV=production-test SMOKE_ALLOW_MUTATIONS=1 ./scripts/smoke-test.sh
```

O backup é obrigatório antes da migration. Se `scripts/backup-postgres.sh` falhar, aborte. `scripts/migrate-production.sh` usa lock para impedir migrations concorrentes. O backup grava dump custom format validado, checksum `.sha256` e log em `backups/postgres`.

## Rollback somente da aplicação

Use quando a versão anterior continua compatível com o schema atual. Não faça downgrade do banco.

```bash
docker compose -f compose.production.yml stop api frontend
export ALOCA_API_IMAGE="registry.example/aloca-api:TAG_ANTERIOR"
export ALOCA_FRONTEND_IMAGE="registry.example/aloca-frontend:TAG_ANTERIOR"
docker compose -f compose.production.yml up -d --no-build api frontend
curl --fail --silent --show-error https://SEU_DOMINIO/health
SMOKE_BASE_URL=https://SEU_DOMINIO SMOKE_ENV=production-test SMOKE_ALLOW_MUTATIONS=1 ./scripts/smoke-test.sh
```

Use uma tag ou digest realmente executado. Não use `--build`, `dotnet ef database update` ou o código atual para reproduzir a imagem anterior.

## Rollback da aplicação e do banco

Use para remoção/renomeação incompatível, conversão destrutiva, perda de dados, `Down` incompleto ou qualquer dúvida. Não execute migration reversa destrutiva automaticamente: `Down` pode apagar dados e não desfaz SQL ou backfill. Migrations destrutivas ou irreversíveis devem ser registradas no release e tratadas por restore ou plano de dados revisado.

Pare a nova versão e valide o dump primeiro em banco separado:

```bash
docker compose -f compose.production.yml stop api frontend
RESTORE_DATABASE=aloca_restore_test ./scripts/restore-postgres.sh backups/postgres/aloca-postgres-AAAAMMDD-HHMMSS.dump
docker compose -f compose.production.yml exec -T postgres sh -ceu \
  'export PGPASSWORD="$(cat /run/secrets/postgres_password)"; psql -X -U "$POSTGRES_USER" -d aloca_restore_test -c "SELECT \"MigrationId\" FROM \"__EFMigrationsHistory\" ORDER BY \"MigrationId\";"'
```

Após conferir arquivo e destino, restaure produção explicitamente. O script recusa produção sem a confirmação:

```bash
RESTORE_DATABASE="${POSTGRES_DB:-aloca}" ALLOW_PRODUCTION_RESTORE=yes \
  ./scripts/restore-postgres.sh backups/postgres/aloca-postgres-AAAAMMDD-HHMMSS.dump
```

Suba as tags anteriores com `--no-build`, depois execute o mesmo `/health` e smoke test do cenário anterior.

## Validação e falhas

`/health` é readiness e verifica PostgreSQL; `/health/live` verifica somente o processo. Aborte se backup, checksum ou restore falhar; se health não retornar 200 saudável; se a migration esperada não aparecer; se houver 5xx persistentes; se o smoke falhar; ou se imagem e schema forem incompatíveis.

Se o restore falhar, não apague o volume nem repita sobre estado parcialmente restaurado. Preserve logs, dump e checksum, isole o tráfego e recupere em instância/volume novo a partir de outra cópia íntegra. Só redirecione a aplicação após conferir migrations/tabelas críticas e executar smoke test. Sem cópia íntegra, mantenha o serviço bloqueado para escritas e acione recuperação do provedor ou backup externo.

Registre timestamp UTC, commit, tags, migrations, nome/checksum do backup, restore, health, smoke e operador. Preserve `aloca_data_protection_keys` para manter cookies e sessões válidos.

