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

- `dotnet test aloca.slnx --filter 'FullyQualifiedName!~Postgres'`: 135 testes aprovados.
- Testes de integração PostgreSQL local: 8 aprovados após a consolidação atual (`dotnet test ... --filter 'FullyQualifiedName~Postgres'`).
- Suíte não-PostgreSQL: 138 testes aprovados após adicionar regressões de processamento de 100 recorrências vencidas, listagem de 100 compromissos e forecast de 100 compromissos em seis meses. Execução observada: cerca de 1 s no ambiente atual; não é um limite de CI.
- PostgreSQL: índices e planos básicos foram inspecionados sem alteração de dados. Transações usam o índice por data; ocorrências usam índice composto existente; compromissos fizeram seq scan com banco vazio, portanto não há evidência suficiente para criar índice agora.
- Build do frontend com Vite já foi validado.
- Verificação de vulnerabilidades NuGet já não reportava pacotes vulneráveis.
- Smoke HTTPS local já foi executado com sucesso.

Não repetir testes destrutivos contra o banco PostgreSQL sem confirmar o escopo: os testes de integração recriam o banco/schema de teste.

## Restrições e decisões importantes

- Não reintroduzir alocações, `AllocatedAmount`, `isFullyCommitted` ou métricas de cobertura no contrato atual.
- Não alterar regras de negócio sem evidência no código, testes ou documentação.
- Não executar migrations destrutivas.
- Não apagar dados do PostgreSQL de produção.
- Usar o banco local `localhost:5432`, database `aloca`, somente para validações explicitamente autorizadas.
- O frontend deve ser desenvolvido após estabilizar contratos, smoke tests e fluxos críticos do backend.

## Próximo passo recomendado

1. Criar um banco/container PostgreSQL temporário isolado, aplicar migrations e carga controlada; então repetir EXPLAIN com volume representativo.
2. Medir consultas de listagem e forecast, incluindo filtros de conta e período.
3. Refatorar a sincronização de ocorrências para trabalhar em lotes e consultar somente o intervalo necessário.
4. Avaliar paginação/performance antes de aumentar o volume de dados.
2. Configurar CI para testes, build e verificação de vulnerabilidades.
3. Validar a aplicação em staging com HTTPS real.
4. Iniciar o frontend por fatias verticais, começando por sessão/conta e dashboard, sem inventar campos fora dos contratos documentados.

## Pendências conhecidas

- Padronizar gradualmente mensagens e respostas de erro.
- Avaliar paginação/filtros para coleções financeiras quando o volume justificar.
- Melhorar processamento automático para grandes volumes.
- A sincronização de recorrências e compromissos ainda carrega agendas completas de até 24 meses em algumas operações; falta medir e definir uma estratégia de lotes.
- O serviço hospedado percorre todas as contas a cada minuto; falta validar o custo com volume representativo e limitar o trabalho por ciclo se necessário.
- Os planos PostgreSQL atuais foram coletados com banco vazio; não devem ser usados como métrica de produção.
- O container `aloca-postgres` disponível é o banco de desenvolvimento `aloca`; nenhuma carga artificial deve ser inserida nele.
- Configurar CI com testes, build e verificação de vulnerabilidades.
- Validar staging HTTPS real.
- Cobrir preflight/CORS com o domínio real do frontend por ambiente.
- Decidir, com evidência de produto, se serão necessárias operações adicionais para pagamento ou cancelamento individual de ocorrências.

## Regra de atualização

Não registre aqui cada comando executado. Atualize apenas estado, decisões, validações, bloqueios e próximo passo. O detalhe cronológico deve ficar em `docs/PROJECT_WORKLOG.md`.
