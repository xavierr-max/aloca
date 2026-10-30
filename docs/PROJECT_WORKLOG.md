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

## 2026-10-30 — regressão de listagem de compromissos

- Adicionado teste com 100 compromissos e geração das ocorrências correspondentes através da listagem oficial.
- O teste confirma 100 itens retornados e uma ocorrência por compromisso, sem alterar o comportamento de produção.
- A primeira execução passou, mas gerou aviso de nulabilidade no teste; o aviso foi corrigido e a suíte foi repetida.
- Resultado final: 137 testes não-PostgreSQL aprovados, sem novos avisos.
- Próximo passo: medir o forecast com carga representativa; depois decidir a otimização de sincronização e paginação.

## 2026-10-30 — medição funcional de forecast

- Adicionado teste com 100 compromissos distribuídos em seis meses.
- O forecast retornou seis meses e 100 detalhes de compromisso, totalizando `2.500,00` em compromissos planejados.
- Resultado específico: 4 testes aprovados em 3,76 s e aproximadamente 189 MB de memória no ambiente atual; valores apenas referenciais.
- Resultado da suíte completa não-PostgreSQL: 138 testes aprovados, 0 falhas, 0 ignorados.
- As falhas intermediárias foram somente ajustes de compilação do teste novo; não houve alteração de produção nem falha funcional.
- Próximo passo: medir as consultas e o SQL no PostgreSQL real, especialmente listagens e forecast, antes de decidir paginação ou processamento em lotes.

## 2026-10-30 — inspeção de índices e planos PostgreSQL

- Cliente `psql` local não estava instalado; a consulta foi executada somente leitura dentro do container `postgres-local` ativo.
- Inspecionados 44 índices do banco `aloca`.
- `transactions` utilizou `IX_transactions_Date` para filtro por período.
- `recurring_income_occurrences` utilizou o índice composto existente, mas ainda ordenou o resultado em memória.
- `financial_commitments` realizou seq scan; com o banco atual vazio isso não comprova problema nem justifica migration de índice.
- Não houve alteração de dados, schema ou migrations.
- Limitação: o banco não contém carga representativa; os tempos não são métricas de produção.
- Próximo passo: gerar carga controlada no PostgreSQL de teste e repetir EXPLAIN incluindo filtros de conta/período.

## 2026-10-30 — tentativa de carga PostgreSQL isolada

- Verificado o ambiente Docker: há um container `aloca-postgres` com o banco de desenvolvimento `aloca`, mas não há container de carga separado ativo.
- A tentativa de acessar um banco de testes existente não foi executada porque o container não possui o usuário esperado; nenhum dado foi alterado.
- Decisão de segurança: não inserir dados artificiais no banco de desenvolvimento.
- Bloqueio técnico atual: para benchmark real, é necessário subir um PostgreSQL temporário, aplicar migrations e carregar dados representativos; o script atual de integração remove o container ao final e ainda não oferece uma etapa de carga/EXPLAIN.
- Ação do usuário necessária: nenhuma imediata; o próximo passo pode criar um fluxo temporário de benchmark isolado.

## 2026-10-30 — benchmark PostgreSQL isolado

- Criado `scripts/benchmark-postgres.sh`, opt-in, que sobe um container temporário, aplica migrations, gera carga e remove o container ao terminar.
- Criado `PostgresPerformanceBenchmarkTests`, fora da suíte normal, com 500 compromissos e 500 transações.
- Resultado: teste aprovado; listagem de compromissos em 847,6 ms e forecast de 12 meses em 369,3 ms.
- Os tempos são linha de base local, não SLA; incluem custo de ORM/consulta em PostgreSQL temporário e podem variar por ambiente.
- O banco de desenvolvimento `aloca` não foi alterado.
- Próximo passo: repetir com múltiplas contas/volume maior e coletar `EXPLAIN ANALYZE` sobre a mesma carga.

## 2026-10-30 — início do frontend descartável

- Substituída a página padrão do Vite por uma base simples de validação em `frontend/src/App.jsx`.
- Implementados os primeiros fluxos: carregamento da sessão, conta local, login e leitura do resumo financeiro.
- Mantido o cliente HTTP existente, com cookies, contexto de conta e tratamento básico de indisponibilidade.
- Criada uma interface provisória, sem compromisso com o UX/UI definitivo.
- Build validado: `npm run build -- --configLoader runner --outDir /tmp/aloca-frontend-validation`.
- Resultado: build Vite aprovado.
- Ação do usuário necessária: abrir o frontend com a API local em execução e validar conta local/login/dashboard no navegador.
- Próximo passo: corrigir eventuais divergências observadas no navegador e implementar grupos/transações.

## 2026-10-30 — grupos e movimentações no frontend descartável

- Implementados grupos: carregar lista, criar grupo e selecionar grupo na movimentação.
- Implementadas movimentações: criar entrada/saída, escolher data/tipo/grupo e atualizar resumo/histórico.
- A tela lista as últimas movimentações usando os contratos paginados existentes.
- Build Vite validado novamente com sucesso.
- Ação do usuário necessária: validar no navegador criação de grupo, entrada, saída e reflexo no saldo.
- Próximo passo: implementar recorrências e recebimento de ocorrências.

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
