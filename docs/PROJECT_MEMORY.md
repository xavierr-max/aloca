# Memória do projeto Aloca

> Documento de retomada para futuras sessões. Leia este arquivo antes de continuar qualquer etapa técnica.

## Como usar esta memória

Ao retomar o projeto, leia nesta ordem:

1. Este arquivo (`docs/PROJECT_MEMORY.md`).
2. `docs/PROJECT_WORKLOG.md`, para o histórico recente.
3. `docs/FINANCIAL-DOMAIN-RULES.md`, para as regras financeiras vigentes.
4. `docs/API_ENDPOINTS.md` e `docs/FRONTEND_INTEGRATION.md`, quando a tarefa envolver contratos ou frontend.
5. `docs/ALLOCATION_REMOVAL_PLAN.md` somente quando a tarefa envolver a migração histórica de alocações.

Depois de qualquer alteração relevante, atualize o worklog e revise as seções de estado e próximo passo deste arquivo.

## Estado atual

- Repositório: `/home/maxwell/Projetos/aloca`.
- Branch de trabalho: `chore/frontend-reset`.
- Último commit registrado nesta memória: `4353bd5 docs: add project continuity memory`.
- Branch sincronizada com `origin/chore/frontend-reset` no último encerramento.
- Frontend: ainda é uma base Vite, preparada para desenvolvimento das telas.
- Fase 1 do frontend descartável iniciada: `App.jsx` agora valida sessão, conta local/login e resumo; a interface é deliberadamente simples e substituível.
- Fase 2 iniciada: a mesma base agora valida grupos, criação de entradas/saídas e histórico das movimentações.
- Fase 3 iniciada: a base agora valida criação de entradas mensais recorrentes, agenda de ocorrências e recebimento manual.
- Fase 4 iniciada: a base agora valida criação de compromissos, pagamento, confirmação de saldo insuficiente e reversão.
- Backend: ASP.NET Core em .NET 10, PostgreSQL com Entity Framework Core e migrations.
- Modelo financeiro vigente: não existem alocações ativas. Compromissos são planejamento; pagamento cria uma única despesa vinculada.

## O que já foi concluído

- Remoção do OpenAPI não utilizado e dos pontos de integração correspondentes.
- Atualização do pacote de criptografia vulnerável para uma versão sem alerta nas fontes atuais.
- Correções no domínio financeiro para pagamento e reversão idempotente.
- Remoção do fluxo ativo de alocações e preservação da migration histórica.
- Atualização dos contratos da API, regras financeiras e integração do frontend.
- Smoke test local HTTP/HTTPS configurado; HTTPS local usa o certificado de desenvolvimento e proxy Vite com `secure: false`.
- Documentação ativa revisada; plano de remoção de alocações marcado como histórico.
- Memória de continuidade criada em `PROJECT_MEMORY.md` e `PROJECT_WORKLOG.md`.

## Validações conhecidas

- `dotnet test aloca.slnx --filter 'FullyQualifiedName!~Postgres'`: 138 testes aprovados.
- Testes de integração PostgreSQL local: 8 aprovados após a consolidação atual (`dotnet test ... --filter 'FullyQualifiedName~Postgres'`).
- Suíte não-PostgreSQL: 138 testes aprovados após adicionar regressões de processamento de 100 recorrências vencidas, listagem de 100 compromissos e forecast de 100 compromissos em seis meses. Execução observada: cerca de 1 s no ambiente atual; não é um limite de CI.
- PostgreSQL: índices e planos básicos foram inspecionados sem alteração de dados. Transações usam o índice por data; ocorrências usam índice composto existente; compromissos fizeram seq scan com banco vazio, portanto não há evidência suficiente para criar índice agora.
- Benchmark PostgreSQL isolado disponível em `scripts/benchmark-postgres.sh`; a execução mais recente usou 500 compromissos e 500 transações, com listagem em 847,6 ms e forecast de 12 meses em 369,3 ms.
- Build do frontend com Vite já foi validado.
- Verificação de vulnerabilidades NuGet já não reportava pacotes vulneráveis.
- Smoke HTTPS local já foi executado com sucesso.
- Build do frontend descartável aprovado com Vite (`/tmp/aloca-frontend-validation`).
- Build atualizado após grupos/movimentações aprovado com Vite.

Não repetir testes destrutivos contra o banco PostgreSQL sem confirmar o escopo: os testes de integração recriam o banco/schema de teste.

## Restrições e decisões importantes

- Não reintroduzir alocações, `AllocatedAmount`, `isFullyCommitted` ou métricas de cobertura no contrato atual.
- Não alterar regras de negócio sem evidência no código, testes ou documentação.
- Não executar migrations destrutivas.
- Não apagar dados do PostgreSQL de produção.
- Usar o banco local `localhost:5432`, database `aloca`, somente para validações explicitamente autorizadas.
- O frontend deve ser desenvolvido após estabilizar contratos, smoke tests e fluxos críticos do backend.

## Próximo passo recomendado

1. Repetir o benchmark com múltiplas contas e volume maior.
2. Repetir EXPLAIN com a carga do benchmark, incluindo filtros de conta e período.
3. Refatorar a sincronização de ocorrências para trabalhar em lotes e consultar somente o intervalo necessário.
4. Avaliar paginação/performance antes de aumentar o volume de dados.
5. Configurar CI para testes, build e verificação de vulnerabilidades.
6. Validar a aplicação em staging com HTTPS real.
7. Validar no navegador sessão, conta local/login, dashboard, grupos, transações, recorrências e compromissos/pagamentos; depois avançar para forecast.

## Pendências conhecidas

- Padronizar gradualmente mensagens e respostas de erro.
- Avaliar paginação/filtros para coleções financeiras quando o volume justificar.
- Melhorar processamento automático para grandes volumes.
- A sincronização de recorrências e compromissos ainda carrega agendas completas de até 24 meses em algumas operações; falta medir e definir uma estratégia de lotes.
- O serviço hospedado percorre todas as contas a cada minuto; falta validar o custo com volume representativo e limitar o trabalho por ciclo se necessário.
- Os planos PostgreSQL atuais foram coletados com banco vazio; não devem ser usados como métrica de produção.
- O container `aloca-postgres` disponível é o banco de desenvolvimento `aloca`; nenhuma carga artificial deve ser inserida nele.
- Cobrir preflight/CORS com o domínio real do frontend por ambiente.
- Decidir, com evidência de produto, se serão necessárias operações adicionais para pagamento ou cancelamento individual de ocorrências.
- A base visual atual é temporária; não criar design system definitivo nesta etapa.

## Regra de atualização

Não registre aqui cada comando executado. Atualize apenas estado, decisões, validações, bloqueios e próximo passo. O detalhe cronológico deve ficar em `docs/PROJECT_WORKLOG.md`.
