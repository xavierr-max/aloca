# API — endpoints e contratos

## Escopo e convenções

Documentação produzida a partir do código em `Aloca.Api` (controllers, DTOs, services, modelos e `Program.cs`). As referências abaixo indicam o arquivo e a linha da implementação; os números podem mudar se o código for editado.

- Base das rotas de negócio: `/api`.
- JSON usa enums como string (`JsonStringEnumConverter`): por exemplo, `Income`, `Expense`, `Monthly`, `Planned`.
- Datas são `DateOnly` e devem ser enviadas como `YYYY-MM-DD`.
- Valores monetários são `decimal` e aparecem em JSON como números.
- Endpoints de negócio são isolados pelo usuário atual via filtros globais do `AlocaDbContext`.
- Os controllers usam `[ApiController]`; falhas de Data Annotations normalmente retornam `400` em Problem Details, com `errors` e `requestId`.
- Exceções não mapeadas passam pelo `UseExceptionHandler`; o formato é Problem Details e inclui `requestId`.
- O cookie de dispositivo é `aloca.device`; a sessão autenticada é o cookie `aloca.auth`. O frontend deve enviar credenciais (`credentials: include`).

## DTOs e enums compartilhados

### Conta

`CurrentAccountDto`: `{ id: UUID, displayName: string, email: string|null, isProtected: boolean, isLocal: boolean, avatarUrl: string|null }`.

`AccountListDto`: `{ accounts: CurrentAccountDto[], current: CurrentAccountDto|null, limit: 4, requiresLogin: boolean }`.

### Categorias/grupos

`CategoryRequest`: `name` obrigatório, 1–100 caracteres. Resposta: `{ id, name }`.

### Movimentação

`TransactionRequest`: `description` obrigatório (1–250), `amount` entre 0,01 e 9.999.999.999.999.999,99, `type` (`Income`/`Expense`), `date`, `categoryId` opcional.

`TransactionResponse`: `{ id, description, amount, type, date, categoryId, categoryName, createdAt, isRecurring, financialCommitmentId, wasAutomatic, isRealized, isBalanceAdjustment }`.

### Entrada recorrente

`RecurringIncomeRequest`: `description` obrigatório (1–250), `amount` >= 0,01, `categoryId` opcional, `frequency` (`Once`, `Weekly`, `Fortnightly`, `Monthly`, `Bimonthly`, `Quarterly`, `Semiannual`, `Annual`), `startDate`, `endDate` opcional, `dayOfMonth` opcional de 1 a 31, `automaticProcessing`.

`RecurringIncomeResponse` inclui `occurrences[]`, cujos status são `Planned`, `Received`, `Cancelled`, `Paused`; cada ocorrência tem `id`, `scheduledDate`, `amount`, `status`, `transactionId`, `cancellationSource`, `processedAt`.

### Compromisso financeiro

`FinancialCommitmentCreateRequest` e `FinancialCommitmentUpdateRequest` têm: `name` obrigatório (1–150), `installmentAmount` >= 0,01, `totalInstallments` opcional >= 1, `priority` opcional >= 1, `categoryId`, `dueDate`, `objective` até 500, `urgent`, `automaticProcessing`, `frequency` opcional e `endDate` opcional. Deve ser informado `totalInstallments` **ou** `frequency`.

`AmountRequest`: `amount` >= 0,01. A resposta do compromisso é `FinancialCommitmentResponse`, que contém métricas de parcelas, pagamentos, alocação, cobertura, flags de ação (`canPay`, `canAllocate`), agenda e `occurrences[]` (`Planned`, `Pending`, `Paid`, `Cancelled`).

### Resumo/configuração

`FinancialSummaryResponse`: `initialBalance`, `totalIncome`, `totalExpense`, `currentBalance`, `allocatedBalance`, `unallocatedBalance`, `freeBalance`, `coverageDeficit`, `businessDate`.

`FinancialSettingsRequest` e `CurrentBalanceAdjustmentRequest`: `{ initialBalance }` ou `{ newBalance }`, respectivamente, com faixa de 0 a 9.999.999.999.999.999,99.

## Conta e autenticação

Implementação: `Aloca.Api/Controllers/AccountController.cs`; regras em `Services/AccountService.cs` e `Services/PasswordRecoveryService.cs`. O controller possui `[AllowAnonymous]`, mas os métodos que operam na conta atual dependem da sessão estabelecida pelo `AccountSessionMiddleware`.

| Método e rota | Entrada | Resposta e status | Regras/efeito |
|---|---|---|---|
| `POST /api/account/password-recovery/request` | `{ "email": "ana@example.com" }` | `202 {message}`; `400` por validação; `429` | Público, limite 5/IP/60s. A mensagem é genérica para não revelar se o e-mail existe; dispara e-mail de recuperação quando aplicável. |
| `POST /api/account/password-recovery/reset` | `{ "token": "...", "password": "novaSenha8", "confirmPassword": "novaSenha8" }` | `204`; `400`; `429` | Público. Token >=32 caracteres; senha >=8; token é de uso único/expira conforme service. |
| `GET /api/account/current` | nenhum | `200 AccountListDto`; `429` | Lista contas vinculadas ao dispositivo, conta atual, limite 4 e se login é necessário. Pode criar/restaurar conta local via middleware. |
| `POST /api/account/logout` | nenhum | `204` | Encerra cookie de autenticação, mas mantém vínculo do dispositivo. |
| `POST /api/account/local/continue` | nenhum | `200 CurrentAccountDto`; `409`; `429` | Cria ou reutiliza a conta local mais recente; máximo de 4 contas por dispositivo. |
| `POST /api/account/local` | `{ "displayName": "Pessoal" }` (opcional) | `200 CurrentAccountDto`; `409`; `429` | Cria conta local e inicia sessão. Nome padrão: `Minha conta`. |
| `POST /api/account/login` | `{ "email": "ana@example.com", "password": "..." }` | `200 CurrentAccountDto`; `401`; `409`; `429` | Autentica conta protegida, vincula-a ao dispositivo se necessário e inicia sessão. Limite de contas do dispositivo é 4. |
| `POST /api/account/protect` | `{ "displayName": "Ana", "email": "ana@example.com", "password": "...", "confirmPassword": "..." }` | `200 CurrentAccountDto`; `401`; `409`; `429` | Converte conta local em protegida; senha >=8 e confirmação igual; e-mail único. |
| `PATCH /api/account/profile` | `{ "displayName": "Ana", "email": "ana@example.com" }` | `200 CurrentAccountDto`; `400`; `401`; `409`; `429` | Conta local altera apenas nome. Conta protegida exige e-mail válido e único. |
| `GET /api/account/avatar` | nenhum | imagem `200` (`image/jpeg`, `image/png` ou `image/webp`); `401`; `404` | Lê avatar da conta atual. O `avatarUrl` inclui `?v=` para cache busting. |
| `POST /api/account/avatar` | `multipart/form-data`, campo `file` | `200 CurrentAccountDto`; `400`; `401`; `429` | JPEG/PNG/WebP, assinatura binária conferida, tamanho máximo 5 MB. |
| `DELETE /api/account/avatar` | nenhum | `204`; `401`; `429` | Remove avatar e arquivo. |
| `PATCH /api/account/rename` | `{ "displayName": "Novo nome" }` | `200 CurrentAccountDto`; `400`; `401`; `429` | Nome obrigatório, 1–80 caracteres. |
| `POST /api/account/password` | `{ "currentPassword": "...", "password": "...", "confirmPassword": "..." }` | `200 CurrentAccountDto`; `401`; `409`; `429` | Apenas conta protegida; senha atual válida, nova senha >=8 e confirmação igual. Renova a sessão. |
| `POST /api/account/switch/{accountId}` | rota: UUID | `200 CurrentAccountDto`; `401`; `404`; `429` | Só troca para conta vinculada ao dispositivo. |
| `DELETE /api/account/device` | nenhum | `204`; `401`; `409`; `429` | Remove a conta protegida atual deste dispositivo. Conta local não pode ser removida por este endpoint; a sessão seguinte é estabelecida pelo middleware. |
| `DELETE /api/account/current` | local: `{ "confirmation": "APAGAR MINHA CONTA" }`; protegida: `{ "confirmation": "Nome exato", "password": "..." }` | `204`; `401`; `409`; `429` | Exclusão permanente dos dados da conta, vínculos e avatar; depois inicia/restaura outra sessão. |

## Grupos/categorias

Implementação: `Aloca.Api/Controllers/CategoriesController.cs` (linhas 9–70), `CategoryService.cs`. Todos exigem autorização.

- `GET /api/groups`: lista `CategoryResponse[]`, ordenado por nome; `200`.
- `GET /api/groups/{id}`: `200 CategoryResponse` ou `404`.
- `POST /api/groups`: `{ "name": "Moradia" }`; `201` com `Location`/resposta; `400` por validação; `409` se nome duplicado (comparação case-insensitive).
- `PUT /api/groups/{id}`: mesmo corpo; `200`, `404`, `409`.
- `DELETE /api/groups/{id}`: `204` ou `404`. Desvincula transações, compromissos e recorrências antes de remover o grupo; não apaga os registros financeiros.

## Resumo, configuração e previsão

Implementações: `FinancialSummaryController.cs`, `FinancialSettingsController.cs`, `FinancialForecastController.cs` e services correspondentes.

- `GET /api/financial-summary`: `200 FinancialSummaryResponse`. Calcula saldo inicial, realizado, reservado, não alocado, livre e déficit; inclui a data de negócio configurada (`Business:TimeZone`, padrão de código em configuração: `America/Sao_Paulo`).
- `GET /api/financial-summary/monthly?period=2026-10-01`: `200 MonthlyFinancialSummaryResponse`. O dia é descartado e o mês é normalizado para o primeiro dia. Sem `period`, usa o mês atual. Inclui entradas, compromissos, métricas realizadas/previstas, compromissos urgentes e saldo final estimado.
- `GET /api/financial-settings`: `200 {initialBalance}`; cria configuração 0 quando ainda não existe.
- `PUT /api/financial-settings`: `{ "initialBalance": 1000.00 }`; `200`; `400` se fora da faixa. Atualiza saldo inicial e reconcilia alocações.
- `POST /api/financial-settings/current-balance-adjustment`: `{ "newBalance": 2500.00 }`; `200 FinancialSummaryResponse`; `400` se negativo. Se necessário cria uma transação de ajuste manual na data de negócio e reconcilia.
- `GET /api/financial-forecast?from=2026-10-01&months=6`: `200 FinancialForecastResponse`; `400` se `months` não estiver entre 1 e 36 ou `from` não for o primeiro dia do mês. `from` padrão é o primeiro dia do mês atual; o horizonte inclui meses, eventos realizados e planejados, compromissos, cobertura e saldo projetado.

## Movimentações

Implementação: `TransactionsController.cs` e `TransactionService.cs`.

### `GET /api/transactions`

Query: `Type=Income|Expense`, `CategoryId=UUID`, `StartDate=YYYY-MM-DD`, `EndDate=YYYY-MM-DD`, `Search=texto`, `Sort=date|amount`, `Descending=true|false`, `Page>=1`, `PageSize=1..100` (padrão 50). Filtros são combináveis; pesquisa é por descrição. Ordenação desconhecida cai em `date`. Retorna `200 PagedResponse<TransactionResponse>`: `{items, page, pageSize, totalItems, totalPages}`. `400` se início > fim ou período > 10 anos. Não há `404` para lista.

Exemplo: `GET /api/transactions?Type=Expense&StartDate=2026-10-01&EndDate=2026-10-31&Page=1&PageSize=20`.

### Operações

- `GET /api/transactions/{id}`: `200 TransactionResponse` ou `404`.
- `POST /api/transactions`: `{ "description": "Aluguel", "amount": 1200, "type": "Expense", "date": "2026-10-05", "categoryId": "UUID" }`; `201` com recurso; `400` por validação ou grupo inexistente. Cria e reconcilia alocações.
- `PUT /api/transactions/{id}`: mesmo corpo; `200`, `400` se grupo inexistente ou tipo diferente do original, `404`, `409` se tentativa de editar pagamento de compromisso.
- `DELETE /api/transactions/{id}`: `204`, `404`, `409`. Pagamentos vinculados não podem ser apagados diretamente; recebimentos recorrentes são marcados como excluídos/cancelados de forma coerente.

## Entradas recorrentes

Implementação: `RecurringIncomesController.cs` e `RecurringIncomeService.cs`.

- `GET /api/recurring-incomes`: `200 RecurringIncomeResponse[]`. Garante ocorrências até 24 meses e processa vencidas com processamento automático; inclui no máximo 120 ocorrências históricas por item.
- `GET /api/recurring-incomes/{id}`: mesma resposta, `404` se inexistente; também sincroniza/processa ocorrências.
- `GET /api/recurring-incomes/projection`: `200 ProjectionMonthResponse[]` para 12 meses; sem paginação.
- `POST /api/recurring-incomes`: corpo `RecurringIncomeRequest`; `200 RecurringIncomeResponse` (não `201`); `404` se `categoryId` não existir. Gera agenda e pode processar vencidas automaticamente.
- `PUT /api/recurring-incomes/{id}`: mesmo corpo; `200` ou `404`; reconcilia ocorrências futuras.
- `POST /api/recurring-incomes/{id}/pause`: `204` ou `404`; pausa ocorrências futuras planejadas.
- `POST /api/recurring-incomes/{id}/activate`: `204` ou `404`; restaura ocorrências futuras pausadas/canceladas e cria agenda.
- `DELETE /api/recurring-incomes/{id}`: `204`, `404` ou `409` se houver dados relacionados; arquiva o item e remove ocorrências não recebidas.
- `POST /api/recurring-incomes/occurrences/{occurrenceId}/receive`: `200 RecurringIncomeOccurrenceResponse` ou `404`. Cria transação de entrada na data de confirmação (ou na data agendada se ela já passou), marca a ocorrência como recebida e reconcilia.

## Compromissos financeiros e alocações

Implementação: `FinancialCommitmentsController.cs` e `FinancialCommitmentService.cs`. O service gera/reconcilia ocorrências em horizonte de 24 meses.

- `GET /api/financial-commitments?isCompleted=false`: `200 FinancialCommitmentResponse[]`, ordenado por prioridade e nome; filtro opcional.
- `GET /api/financial-commitments/{id}`: `200` ou `404`.
- `POST /api/financial-commitments`: corpo do create; `201` com compromisso criado; `400` para agenda inválida (por exemplo, ausência de parcelas e frequência); `409` para categoria inexistente ou outro conflito de domínio.
- `PUT /api/financial-commitments/{id}`: corpo do update; `200`, `400`, `404`, `409`.
- `DELETE /api/financial-commitments/{id}`: `204`, `404`, `409` quando pagamentos impedem exclusão.
- `POST /api/financial-commitments/{id}/payments`: opcionalmente `{ "confirmInsufficientBalance": true }`; cria pagamento e despesa vinculada. Retorna `422` quando o saldo é insuficiente sem confirmação.
- `POST /api/financial-commitments/{id}/occurrences/{occurrenceId}/payment`: mesmo contrato, para uma ocorrência específica.
- `DELETE /api/financial-commitments/{id}/payments/latest`: cria estorno auditável para o último pagamento ativo.
- `DELETE /api/financial-commitments/{id}/occurrences/{occurrenceId}/payment`: estorna o pagamento da ocorrência indicada.
- `POST /api/financial-commitments/{id}/payments`: registra pagamento da próxima parcela; `200`, `404`, `409`.
- `POST /api/financial-commitments/{id}/occurrences/{occurrenceId}/payment`: paga ocorrência específica; `200`, `404`, `409`.
- `DELETE /api/financial-commitments/{id}/payments/latest`: desfaz último pagamento; `200`, `404`, `400`.
- `DELETE /api/financial-commitments/{id}/occurrences/{occurrenceId}/payment`: desfaz pagamento da ocorrência; `200`, `404`, `400`.

Todas as mutações retornam o compromisso completo atualizado, exceto as operações de exclusão/limpeza que ainda retornam `200` com o recurso. Pagamento cria uma transação vinculada; a transação não pode ser editada/excluída pela API genérica.

## Saúde e infraestrutura HTTP

- `GET /health/live`: health check sem dependências (`200` quando o processo responde).
- `GET /health/ready` e `GET /health`: readiness verificando PostgreSQL (`200` saudável; status de health check quando não saudável).

`Program.cs` aplica CORS pela política `Frontend`, com origens em `Cors:AllowedOrigins`, qualquer header/método e credenciais. Limites padrão por janela de 60s: global 120 por chave, conta 12, heavy 40 (nenhuma rota atualmente usa explicitamente a policy `heavy`) e recuperação 5/IP. Excesso retorna `429`, header `Retry-After: 60` e mensagem em português. O header `X-Request-Id` é ecoado/gerado e também aparece em Problem Details.

## Arquivos de implementação consultados

`Aloca.Api/Program.cs`; todos os arquivos em `Aloca.Api/Controllers/`; todos os DTOs em `Aloca.Api/DTOs/`; `Services/AccountService.cs`, `TransactionService.cs`, `RecurringIncomeService.cs`, `FinancialCommitmentService.cs`, `FinancialSummaryService.cs`, `FinancialSettingsService.cs`, `FinancialForecastService.cs`, `FinancialBalanceService.cs`, `CategoryService.cs`, `PasswordRecoveryService.cs`; modelos e `Data/AlocaDbContext.cs`.
