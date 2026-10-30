# Integração do frontend com a API

Este documento mapeia capacidades confirmadas no backend para telas e estados de interface. O código atual do frontend em `frontend/src/services/api.js` já cobre todas as operações de negócio principais.

## Mapa de telas e ações

| Tela/funcionalidade | Ação do usuário | Endpoint | Dados enviados | Resultado esperado |
|---|---|---|---|---|
| Inicialização | Abrir aplicação | `GET /api/account/current` | nenhum | Restaurar conta/dispositivo ou mostrar escolha de login |
| Conta local | Continuar | `POST /api/account/local/continue` | nenhum | Sessão local e dashboard |
| Conta local | Criar | `POST /api/account/local` | `displayName` opcional | Nova conta local |
| Login | Enviar formulário | `POST /api/account/login` | e-mail/senha | Sessão protegida; atualizar contexto inteiro |
| Recuperação | Solicitar e-mail | `POST /api/account/password-recovery/request` | e-mail | Mostrar mensagem genérica |
| Recuperação | Definir senha | `POST /api/account/password-recovery/reset` | token/senha/confirmação | Redirecionar para login |
| Conta | Proteger conta local | `POST /api/account/protect` | nome/e-mail/senha | Atualizar identidade |
| Conta | Editar perfil | `PATCH /api/account/profile` | nome/e-mail | Atualizar cabeçalho e configurações |
| Conta | Avatar | `POST/GET/DELETE /api/account/avatar` | multipart ou nenhum | Atualizar imagem/cache |
| Conta | Trocar conta | `POST /api/account/switch/{id}` | id | Invalidar dados carregados e recarregar tudo |
| Conta | Sair/remover/excluir | `POST /logout`, `DELETE /device`, `DELETE /current` | confirmação quando aplicável | Encerrar/remontar sessão |
| Dashboard | Abrir | `GET /api/financial-summary` | nenhum | KPIs de saldo e cobertura |
| Dashboard | Ver mês | `GET /api/financial-summary/monthly?period=...` | mês | Cards, compromissos e projeção mensal |
| Configurações | Ler/alterar saldo inicial | `GET/PUT /api/financial-settings` | `initialBalance` | Persistir configuração |
| Configurações | Corrigir saldo atual | `POST /api/financial-settings/current-balance-adjustment` | `newBalance` | Atualizar resumo; backend cria ajuste |
| Grupos | Listar/cadastrar/editar/excluir | `GET/POST/PUT/DELETE /api/groups` | nome/id | Atualizar selects e registros dependentes |
| Histórico | Listar | `GET /api/transactions` | filtros, página, ordenação | Tabela paginada |
| Histórico | Criar/editar/excluir | `POST/PUT/DELETE /api/transactions` | contrato de transação | Atualizar lista, resumo e cobertura |
| Recorrentes | Listar | `GET /api/recurring-incomes` | nenhum | Lista + histórico de ocorrências |
| Recorrentes | Projeção | `GET /api/recurring-incomes/projection` | nenhum | Gráfico/lista de 12 meses |
| Recorrentes | Criar/editar | `POST/PUT /api/recurring-incomes` | agenda/valor/grupo | Atualizar recorrente e previsões |
| Recorrentes | Pausar/ativar | `POST .../pause` ou `.../activate` | nenhum | Alterar estado local |
| Recorrentes | Receber ocorrência | `POST .../occurrences/{id}/receive` | nenhum | Criar entrada real e atualizar resumo |
| Planejamento | Listar | `GET /api/financial-commitments` | filtros de conclusão/cobertura | Cards/tabela de compromissos |
| Planejamento | Criar/editar/excluir | `POST/PUT/DELETE /api/financial-commitments` | contrato do compromisso | Atualizar agenda e alocações |
| Planejamento | Consultar obrigações | `GET /api/financial-commitments` e forecast | filtros e período | Atualizar valores previstos e ocorrências |
| Planejamento | Pagar/desfazer | endpoints de payments | nenhum | Mover ocorrência para paga e criar/remover transação vinculada |
| Previsões | Abrir | `GET /api/financial-forecast` | `from`, `months` | Série mensal com eventos e saldo projetado |
| Saúde | Detectar indisponibilidade | `GET /health` | nenhum | Banner global de indisponibilidade |

## Regras de estado confirmadas

Após qualquer mutação financeira, o frontend deve considerar obsoletos pelo menos resumo, resumo mensal, forecast, lista de transações e compromissos. A API não retorna um envelope de invalidação; a atualização é responsabilidade do cliente.

Após `switch`, `login`, `logout`, exclusão ou remoção de conta, todos os GETs em andamento devem ser descartados ou particionados pelo contexto da conta. O frontend existente já adiciona `__account_context` apenas para deduplicação local; o backend ignora esse parâmetro.

Paginação só existe em transações. Compromissos, grupos e recorrentes são coleções completas. O backend limita o histórico carregado de cada recorrente a 120 ocorrências, mas não oferece paginação de ocorrências.

## Formulários

- Conta: criação local, login, proteção, perfil, troca de senha, recuperação, confirmação de exclusão, avatar.
- Grupo: nome.
- Transação: descrição, valor, tipo, data e grupo opcional.
- Entrada recorrente: descrição, valor, grupo, frequência, início/fim, dia do mês e processamento automático.
- Compromisso: nome, valor da parcela, parcelas **ou** frequência, vencimento, prioridade, cobertura total, grupo, objetivo, urgente e processamento automático.
- Configuração: saldo inicial ou novo saldo atual.

Valores monetários devem ser normalizados para número antes do JSON. Datas devem ser strings `YYYY-MM-DD`; não converter para `Date` local/UTC de forma que altere o dia.

## Tratamento de erros

O backend usa quatro formatos principais: `204` sem corpo; resposta JSON de sucesso; `{message}` para erros de negócio; Problem Details com `errors` para validação automática. O cliente deve priorizar `message`, depois concatenar `errors`, depois `detail`, e preservar `requestId` para suporte.

- `400`: validação, período inválido, grupo inexistente em algumas operações ou regra de domínio mapeada como Bad Request.
- `401`: sessão ausente/inválida ou senha incorreta.
- `404`: recurso/conta/grupo/ocorrência inexistente.
- `409`: conflito de unicidade, limite de contas, exclusão bloqueada, operação incompatível.
- `422`: alguns erros de alocação classificados explicitamente pelo service.
- `429`: limite de requisições; respeitar `Retry-After`.
- `5xx`: indisponibilidade/erro inesperado; usar `/health` para distinguir indisponibilidade global de falha de recurso.

## Autenticação e sessão

É autenticação por cookie, não bearer token. `fetch`/Axios deve usar credenciais. O cookie de autenticação é HttpOnly, SameSite Strict, Secure em produção, duração de 14 dias e sliding expiration. O cookie de dispositivo identifica os vínculos locais e protegidos; não deve ser manipulado pelo JavaScript.

O fluxo inicial confirmado é: `GET /api/account/current` → se `current` existir, carregar dados; se `requiresLogin`, mostrar login; caso contrário, permitir continuar/criar local. Em login explícito, o backend vincula a conta ao dispositivo e pode retornar `409` se o limite de quatro vínculos for atingido.

## Confirmado versus sugestão

Confirmado: endpoints, campos, códigos descritos em `API_ENDPOINTS.md`, filtros de transações, horizonte de forecast e regras de sessão.

Sugestão de UI: usar optimistic update somente para estados simples de pausa/ativação; para valores financeiros, refazer as consultas relacionadas após `200`, porque alocação, reconciliação e processamento automático podem alterar múltiplos recursos. Também é recomendável centralizar mapeamento de `401/409/422/429` e exibir mensagens vindas da API.
