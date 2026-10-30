# Histórico de trabalho do projeto Aloca

Registro compacto para permitir retomada segura entre sessões.

## 2026-10-30 — documentação alinhada ao domínio atual

- Revisados `README.md`, `docs/API_ENDPOINTS.md`, `docs/APPLICATION_FLOWS.md` e `docs/FINANCIAL-DOMAIN-RULES.md`.
- Removidas referências ativas a alocações, cobertura e saldo livre.
- Corrigido o README para usar `/api/groups` e descrever pagamentos como despesas vinculadas.
- `docs/ALLOCATION_REMOVAL_PLAN.md` foi mantido e classificado como histórico.
- Validação: `git diff --check` aprovado; 135 testes não-PostgreSQL aprovados.
- Commit: `a96b4a9 docs: align documentation with current domain`.
- Push: concluído em `origin/chore/frontend-reset`.

## 2026-10-30 — atualização do plano de continuidade

- Revisado o plano informado para as fases 1 e 2.
- Confirmado como concluído: revisão dos endpoints, remoção de duplicidades documentais, remoção de referências ativas a alocação/cobertura e atualização do contrato financeiro/frontend.
- Confirmado como concluído: `docs/ALLOCATION_REMOVAL_PLAN.md` marcado como documento histórico.
- Registrado como pendente: repetir os 8 testes PostgreSQL após a consolidação; melhorar processamento automático para grandes volumes; avaliar paginação/performance; configurar CI; validar staging HTTPS real; iniciar frontend somente após essas estabilizações.
- Nenhum teste PostgreSQL foi executado nesta atualização documental.
- Próxima ação: executar os 8 testes PostgreSQL com o banco local autorizado e registrar evidência antes de avançar para performance/CI.

## 2026-10-30 — validação PostgreSQL pós-consolidação

- Executado: `ALOCA_TEST_POSTGRES_CONNECTION=... dotnet test tests/Aloca.Api.Tests/Aloca.Api.Tests.csproj --filter 'FullyQualifiedName~Postgres'`.
- Resultado: 8 testes aprovados, 0 falhas, 0 ignorados.
- Escopo validado: migrations, tipos/constraints, foreign keys, transações, health check, compatibilidade legada e concorrência de pagamentos.
- Ação do usuário necessária: nenhuma nesta etapa.
- Próximo passo: analisar processamento automático e performance de consultas/coleções antes de iniciar o frontend.

## 2026-10-30 — auditoria inicial de processamento e performance

- Inspecionados `AutomaticProcessingHostedService`, `RecurringIncomeService`, `FinancialCommitmentService`, `FinancialForecastService` e `ForecastEventNormalizer`.
- Risco confirmado: o ciclo automático percorre todas as contas a cada minuto e executa sincronização de ocorrências para horizonte de 24 meses por conta.
- Risco confirmado: a sincronização carrega entidades e ocorrências completas para reconciliar agendas; forecast e algumas listagens também materializam coleções inteiras.
- Decisão: não aplicar uma refatoração de performance sem teste de volume, pois a sincronização atual também corrige dados históricos e reconcilia estados.
- Próxima ação: criar testes de volume/performance e medir tempo, memória, quantidade de linhas carregadas e duração do ciclo automático; depois implementar processamento em lotes com regressão funcional.
- Ação do usuário necessária: nenhuma nesta etapa.

## 2026-10-30 — regressão de processamento de recorrências

- Adicionado teste em `AutomaticProcessingTests` com 100 entradas recorrentes vencidas.
- O teste valida processamento em lote funcional, uma transação por ocorrência e segunda execução idempotente sem duplicação.
- Durante a criação do teste, foi confirmado que uma recorrência iniciada no mês anterior possui duas ocorrências vencidas legítimas; o cenário foi ajustado para uma ocorrência por item, sem alteração do código de produção.
- Resultado: 136 testes não-PostgreSQL aprovados, 0 falhas.
- Próximo passo: benchmark/teste de volume maior e medição antes da refatoração de consultas.

## 2026-10-30 — execução do volume maior

- A primeira tentativa foi bloqueada pelo ambiente ao criar canais internos do MSBuild; nenhum teste chegou a iniciar.
- Reexecução autorizada concluída com sucesso: 136 testes aprovados, 0 falhas, 0 ignorados.
- Tempo observado da suíte: 6,32 s; memória máxima observada: aproximadamente 208 MB. Esses valores são referência local, não critérios de CI.
- O cenário de 100 recorrências confirmou processamento e idempotência sem alteração de produção.
- Próximo passo: medir forecast e listagens com dados representativos e decidir a refatoração em lotes/paginação com base nesses dados.

## Estado anterior consolidado

- A branch `chore/frontend-reset` recebeu a estabilização do backend e a remoção do OpenAPI não utilizado.
- O pacote `System.Security.Cryptography.Pkcs` foi atualizado e a verificação NuGet deixou de reportar vulnerabilidades.
- Foram executados testes unitários/funcionais, integração PostgreSQL local e smoke test HTTPS local.
- O frontend ainda não foi desenvolvido além da base Vite; o próximo ciclo deve priorizar contratos de sessão e dashboard.

## Modelo de entrada para novas sessões

Ao concluir uma tarefa, acrescente uma entrada com:

- data;
- objetivo;
- arquivos alterados;
- validações executadas e resultado;
- commit/push, se houver;
- bloqueios ou ação necessária do usuário;
- próximo passo recomendado.

Não marque uma etapa como concluída sem registrar a evidência correspondente.
