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
- Último commit registrado nesta memória: `a96b4a9 docs: align documentation with current domain`.
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

## Validações conhecidas

- `dotnet test aloca.slnx --filter 'FullyQualifiedName!~Postgres'`: 135 testes aprovados.
- Testes de integração PostgreSQL local já foram executados anteriormente: 8 aprovados, total conhecido de 143.
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

1. Fazer uma revisão final de contratos e comportamento da API, comparando DTOs, controllers, serviços e documentação.
2. Criar ou ampliar testes de contrato para os fluxos que o frontend usará primeiro: sessão, resumo, grupos, transações, compromissos/pagamentos e recorrências.
3. Implementar o frontend por fatias verticais, começando por sessão/conta e dashboard, sem inventar campos fora dos contratos documentados.

## Pendências conhecidas

- Padronizar gradualmente mensagens e respostas de erro.
- Avaliar paginação/filtros para coleções financeiras quando o volume justificar.
- Cobrir preflight/CORS com o domínio real do frontend por ambiente.
- Decidir, com evidência de produto, se serão necessárias operações adicionais para pagamento ou cancelamento individual de ocorrências.

## Regra de atualização

Não registre aqui cada comando executado. Atualize apenas estado, decisões, validações, bloqueios e próximo passo. O detalhe cronológico deve ficar em `docs/PROJECT_WORKLOG.md`.
