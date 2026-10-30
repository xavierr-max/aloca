# Auditoria arquitetural — remoção do sistema de alocações financeiras

## Escopo e método

Esta auditoria cobre o estado atual do backend em `Aloca.Api`, testes em `tests/Aloca.Api.Tests`, contratos/documentação em `docs` e as referências atuais do cliente em `frontend/src/services/api.js`. Não foram alterados código, migrations ou testes. O worktree já possuía alterações não relacionadas, inclusive remoções/adições no frontend; elas foram preservadas.

As localizações abaixo usam linhas do estado auditado. Arquivos de migration `*.Designer.cs` repetem o snapshot histórico; quando necessário, a referência principal é a migration executável e `AlocaDbContextModelSnapshot.cs`.

## Diagnóstico executivo

O sistema já possui uma base importante para o modelo desejado:

- `FinancialBalanceService` calcula o saldo real com saldo inicial + receitas em transações − despesas em transações (`Aloca.Api/Services/FinancialBalanceService.cs:31-32, 51-66`).
- `FinancialCommitmentService.RegisterPaymentAsync` cria, na mesma operação, um `CommitmentPayment` e uma `Transaction` de tipo `Expense` vinculada (`Aloca.Api/Services/FinancialCommitmentService.cs:75-129`).
- `TransactionConfiguration` mantém índice único por `CommitmentPaymentId` (`Aloca.Api/Data/Configurations/TransactionConfiguration.cs:43-49`), e `CommitmentPaymentConfiguration` mantém unicidade por compromisso/parcela e ocorrência (`.../CommitmentPaymentConfiguration.cs:22-27`).
- O desfazimento remove pagamento e sua movimentação na mesma transação (`FinancialCommitmentService.cs:153-188`).
- Receitas recorrentes também materializam movimentações e já distinguem ocorrência planejada de ocorrência recebida; esse fluxo deve permanecer.

Mas a regra atual ainda é de reserva prévia: `RegisterPaymentAsync` exige que a parcela esteja 100% alocada (`FinancialCommitmentService.cs:100-103`), e `ProcessDueAsync` não processa automaticamente sem alocação (`:138-145`). Cadastro e vencimento não criam despesa, mas a cobertura/reserva é tratada como uma condição de pagamento e contamina saldo disponível, resumo e previsão.

Conclusão objetiva: é possível eliminar completamente as alocações sem prejudicar o registro de pagamentos, desde que o pagamento passe a ser a única operação contábil de saída, permaneçam `CommitmentPayment`, `FinancialCommitmentOccurrence` e `Transaction`, e a migração preserve os históricos. Não é seguro simplesmente apagar `AllocatedAmount` e os endpoints: o contrato de pagamento, o processamento automático, os cálculos, o frontend e os testes precisam ser migrados em conjunto.

## 1. Modelo financeiro atual e modelo desejado

### Fórmulas atuais

O saldo contábil já está próximo do modelo desejado:

```text
saldo_real = saldo_inicial + entradas_confirmadas - saídas_efetivamente_pagas
```

No código, `FinancialCalculations.SaldoReal` recebe entradas e saídas (`FinancialBalanceService.cs:29-32`), enquanto `FinancialBalanceService.GetAsync` soma transações com `Date <= today` (`:51-62`). Uma obrigação futura não cria transação.

O problema está nas métricas derivadas:

```text
total_reservado = soma(AllocatedAmount de compromissos ativos)
saldo_nao_alocado = max(0, saldo_real - total_reservado)
deficit_cobertura = max(0, obrigações_pendentes - total_reservado)
saldo_livre = max(0, saldo_nao_alocado - deficit_cobertura)
```

Essas fórmulas estão em `FinancialDomainCalculator.cs:33-60` e são consumidas por `FinancialBalanceService.cs:56-66`. Assim, a reserva não reduz `saldo_real`, mas reduz `saldo_nao_alocado`/ `saldo_livre` e é usada como pré-condição para pagar. O conceito de `Committed` representa obrigações futuras, enquanto `Allocated` representa dinheiro apartado.

### Modelo recomendado

Manter:

```text
saldo_atual = saldo_inicial + receitas realizadas - despesas realizadas
```

Separar explicitamente:

```text
obrigações_pendentes = parcelas planejadas ou vencidas ainda não pagas
saldo_projetado(periodo) = saldo_atual
                           + receitas planejadas do período
                           - despesas previstas das obrigações não pagas
                           - outras despesas planejadas
```

`obrigações_pendentes` deve aparecer em planejamento/previsão, mas não em nenhum saldo contábil atual e não como `Allocated`. O vencimento só muda o status da ocorrência para `Pending`; o pagamento cria a despesa e marca a ocorrência como `Paid`.

### Consistência entre áreas

- **Movimentações:** toda entrada/saída realizada é uma `Transaction`; pagamento de obrigação é uma despesa vinculada ao pagamento.
- **Pagamentos:** operação única e transacional para atualizar parcela/ocorrência, inserir `CommitmentPayment` e inserir a `Transaction`.
- **Pagamento manual:** comportamento padrão. A requisição deve aceitar `confirmInsufficientBalance`, com valor padrão `false`. Sem confirmação, se o saldo real for insuficiente, retornar erro de negócio específico contendo saldo atual, valor do pagamento e valor da insuficiência. Com `confirmInsufficientBalance = true`, permitir o saldo negativo após revalidar a condição dentro da operação transacional.
- **Pagamento automático:** somente para obrigações com `AutomaticProcessing = true`, habilitado explicitamente. O job não executa a parcela quando o saldo real disponível não cobre seu valor integral.
- **Receitas recorrentes:** preservar `RecurringIncomeOccurrence`, `TransactionId`, processamento automático e o índice único da transação por ocorrência.
- **Resumo mensal:** `committed` deve continuar sendo planejamento; `allocated`, `coverage` e `missing` devem ser removidos ou substituídos por `planned`, `paid`, `pending` e `projected closing balance`. A despesa do pagamento entra em `transactions`, não em uma segunda categoria.
- **Previsão:** eventos planejados continuam sendo projetados; evento pago deve aparecer como realizado e não ser contado novamente como planejado.

## 2. Inventário de funcionalidades de alocação

### Entidade e regras de domínio

| Localização | Elemento | Responsabilidade atual | Dependências | Consequência | Recomendação |
|---|---|---|---|---|---|
| `Aloca.Api/Models/FinancialCommitment.cs:11-66, 68-86` | construtores e `AllocatedAmount` | Inicializa e persiste o saldo reservado por obrigação | EF, DTOs, serviços, migrations | Obrigações históricas deixam de ter campo de reserva | Refatorar; manter compatibilidade temporária ou migrar dados antes de remover |
| `FinancialCommitment.cs:122-160` | `TotalAllocatedAmount`, `OverallCoveragePercentage`, `CoveredInstallments`, `AmountNeededForNextInstallment`, `AmountNeededForFullCoverage`, `ExcessAllocatedAmount` | Mede cobertura, falta e excesso de reserva | Respostas, resumo, previsão, testes | Métricas deixam de representar o domínio | Remover/substituir por `TotalPaidAmount`, `RemainingAmount`, status de ocorrência e previsão |
| `FinancialCommitment.cs:211-237` | `Allocate`, `Deallocate`, `ReleaseAllAllocation` | Distribui/libera reserva sem criar movimentação | Controller, service, reconciliação, testes | Comportamento inteiro deixa de existir | Remover após migração de dados |
| `FinancialCommitment.cs:239-263` | `RegisterPayment`, `ReverseLatestPayment` | Paga consumindo reserva e, ao desfazer, recoloca a reserva | `RegisterPaymentAsync`, testes | Pagamento não pode mais alterar alocação | Refatorar para alterar apenas pagamento/parcelas |
| `FinancialCommitment.cs:96, 100` | `AllocatedAmount`, `IsFullyCommitted` | Valor reservado e flag que habilita distribuição/filtragem | Índice e filtros | `IsFullyCommitted` perde sentido como cobertura | Remover do contrato se não houver outro significado de negócio |

### Serviços e concorrência

| Localização | Elemento | Responsabilidade atual | Dependências | Recomendação |
|---|---|---|---|---|
| `Aloca.Api/Services/FinancialAllocationService.cs:7-60` | `PreviewAsync`, `DistributeAsync`, `BuildPlanAsync` | Ordena compromissos por prioridade e distribui saldo disponível | `FinancialBalanceService`, `FinancialCommitment.Allocate`, `FinancialAllocationConcurrency`, DTOs | Remover classe e DTOs |
| `Aloca.Api/Services/FinancialAllocationReconciliationService.cs:6-57` | `ReconcileAsync` | Remove reservas excedentes quando saldo real cai; nunca cria transação | `TransactionService`, `FinancialCommitmentService`, `FinancialBalanceService`, DI | Remover |
| `Aloca.Api/Services/FinancialAllocationConcurrency.cs` | `Gate` global | Serializa distribuição entre requisições | Serviços de alocação | Remover; manter lock por compromisso para pagamento ou usar concorrência no banco |
| `Program.cs:161-167` | DI | Registra reconciliação | Transaction/commitment services | Remover registro e construtor opcional |
| `TransactionService.cs:17-21, 108-124, 129-162, 164-185` | `Reconciliation` | Executa reconciliação após criar, editar ou excluir movimentação | Serviço de transação | Remover chamada e dependência |
| `FinancialCommitmentService.cs:9-13, 191-287` | métodos de alocação | Endpoints e mutações transacionais de reserva | Controller, entidade, saldo | Remover todos os métodos e lock global |

### Cálculos e aliases

| Localização | Elemento | Responsabilidade atual | Recomendação |
|---|---|---|---|
| `FinancialBalanceService.cs:7-27` | `TotalReservado`, `SaldoNaoAlocado`, `SaldoLivre`, `AllocationDeficit` e aliases em inglês | Expõe saldo real junto com reserva e cobertura | Preservar `SaldoReal`/`CurrentBalance`; remover métricas de reserva |
| `FinancialBalanceService.cs:34-44` | `TotalReservado`, `SaldoNaoAlocado`, `DeficitCobertura`, `SaldoLivre` | Fachada para fórmulas de reserva | Remover; criar funções de obrigação pendente/projeção se necessário |
| `FinancialDomainCalculator.cs:33-60` | `ReserveMetrics`, `Reserved`, `Unallocated`, `CoverageDeficit`, `Free`, `CalculateReserveMetrics` | Núcleo das métricas de cobertura | Remover e manter `CalculatePeriodMetrics`, `RealResult`, `ForecastResult` |
| `FinancialCommitmentService.cs:24-33, 191-287` | `SaldoNaoAlocado`, `CanAllocate`, cobertura | Alimenta respostas e validações | Refatorar para não calcular nem expor reserva |

### DTOs e contratos

`Aloca.Api/DTOs/FinancialAllocationDtos.cs:3-19` é exclusivo de preview/distribuição e pode ser removido.

`FinancialCommitmentDtos.cs:6-50` contém `IsFullyCommitted`, `AllocatedAmount`, `CoveredInstallments`, `MissingForNextInstallment`, `MissingForFullCoverage`, `ExcessAllocatedAmount`, `TotalAllocatedAmount`, `OverallCoveragePercentage`, `AllocatedForNextInstallment`, `RemainingForNextInstallment`, `CoveragePercentage`, `AvailableToAllocate` e `CanAllocate`. Esses campos devem ser removidos ou substituídos. `CanPay` deve deixar de significar “há reserva” e passar a significar “há ocorrência/obrigação pagável e valor válido”. Ocorrências, `CommitmentPaymentId`, `Status` e `ProcessedAt` devem permanecer.

`FinancialForecastDtos.cs:38-79` contém `Committed`, `Allocated`, `Coverage`, `CoverageDeficit`, `AllocatedAmount`, `CoveragePercentage`, `TotalAllocated`, `UnallocatedBalance`, `FreeBalance` e `RequiredAmount`. `Committed` pode permanecer somente se documentado como obrigações previstas; os demais campos de reserva devem sair ou ser renomeados para métricas de previsão.

`FinancialSummaryResponse.cs:7-21, 27-68` expõe `AllocatedBalance`, `UnallocatedBalance`, `CoverageDeficit` e aliases (`AllocatedAmount`, `TotalReservado`, `SaldoNaoAlocado`, `DeficitCobertura`). A resposta deve manter saldo inicial, receitas, despesas e saldo atual; no resumo mensal, manter compromissos futuros e valores pagos/previstos sem cobertura.

Não foram encontradas propriedades/classes com os nomes literais `ProtectedAmount`, `TotalProtectedAmount` ou `AvailableToUse`. Os equivalentes funcionais encontrados são `AllocatedAmount`/`TotalReservado`, `SaldoNaoAlocado`/`UnallocatedBalance` e `AvailableToAllocate`; portanto, a auditoria não trata os nomes literais como componentes adicionais.

## 3. Rotas de alocação

Todas estão em `Aloca.Api/Controllers/FinancialCommitmentsController.cs`:

| Rota | Método do controller | Serviço | Persistência | Ação |
|---|---|---|---|---|
| `POST /api/financial-commitments/{id}/allocations` | `Allocate`, `:44-50` | `AllocateAsync`, `FinancialCommitmentService.cs:191-212` | incrementa `FinancialCommitments.AllocatedAmount` | Remover |
| `POST .../{id}/deallocations` | `Deallocate`, `:52-58` | `DeallocateAsync`, `:255-270` | decrementa `AllocatedAmount` | Remover |
| `POST .../{id}/allocations/next-installment` | `AllocateNextInstallment`, `:60-65` | `AllocateNextInstallmentAsync`, `:214-233` | incrementa até a parcela | Remover |
| `DELETE .../{id}/allocations` | `ReleaseAllAllocation`, `:67-72` | `ReleaseAllAllocationAsync`, `:272-287` | zera `AllocatedAmount` | Remover |
| `POST .../{id}/allocations/available` | `AllocateAvailable`, `:74-79` | `AllocateAvailableAsync`, `:235-253` | incrementa até o saldo “não alocado” | Remover |

Não há controller separado para `FinancialAllocationService`; ele é usado diretamente em testes e pode ser removido depois que contratos e testes forem migrados. `docs/API_ENDPOINTS.md:137-141` documenta as cinco rotas e `docs/FRONTEND_INTEGRATION.md:32-34` orienta a UI a atualizar saldo livre/alocações; ambos precisam ser atualizados.

## 4. Auditoria do fluxo de pagamento

### Pagamento

Ambos os endpoints chamam `RegisterPaymentAsync` (`FinancialCommitmentsController.cs:81-93`). O fluxo atual é:

1. Obtém `SemaphoreSlim` por compromisso e, em banco relacional, abre transação `Serializable` (`FinancialCommitmentService.cs:75-85`).
2. Localiza a ocorrência específica ou a primeira não paga/não cancelada (`:86-97`).
3. Retorna sem alteração se a ocorrência já estiver paga (`:98-99`).
4. Exige reserva suficiente para a parcela (`:100-103`).
5. Incrementa parcelas pagas e consome `AllocatedAmount` (`:103-105`, domínio `FinancialCommitment.cs:239-249`).
6. Cria `CommitmentPayment` e `Transaction(Expense)` com `FinancialCommitmentId` e `CommitmentPaymentId` (`:106-110`).
7. Marca a ocorrência como paga (`:110`).
8. Salva tudo e faz commit; em falha de unicidade tenta reconhecer um pagamento concorrente (`:111-126`).

Respostas objetivas:

1. **O pagamento já cria uma despesa?** Sim, uma `Transaction` `Expense` vinculada a `CommitmentPayment`.
2. **Ela já reduz o saldo atual?** Sim. `FinancialBalanceService` soma todas as despesas com data até hoje; a transação criada pelo pagamento entra uma vez (`FinancialBalanceService.cs:53-62`).
3. **Exige alocação prévia?** Sim. `missing > 0` causa `InvalidOperationException`; o processamento automático também interrompe sem `AllocatedAmount` suficiente (`FinancialCommitmentService.cs:100-103, 138-145`).
4. **Há desconto duplicado hoje?** A alocação não cria transação, então o saldo contábil não é descontado duas vezes. A reserva reduz apenas saldo não alocado/livre. O risco futuro é manter ambos os conceitos após a migração ou contar a despesa vinculada também como obrigação planejada.
5. **Como pagamentos automáticos são processados?** `AutomaticProcessingHostedService` roda imediatamente e a cada minuto, percorre contas e chama `FinancialCommitmentService.ProcessDueAsync` (`AutomaticProcessingHostedService.cs:6-36`). O serviço deve continuar criando ocorrências, buscar apenas compromissos com `AutomaticProcessing = true` e processar vencidos sem usar reserva. Antes do commit, deve revalidar que o saldo real cobre integralmente a parcela; se não cobrir, não cria pagamento nem despesa, não usa `confirmInsufficientBalance`, mantém a ocorrência pendente e registra aviso para retry posterior. O cadastro permanece manual por padrão (`AutomaticProcessing = false`).
6. **O que ocorre ao desfazer?** `ReverseLatestPaymentAsync` usa lock e transação, escolhe o último pagamento (ou o da ocorrência), decrementa `PaidInstallments`, restaura a ocorrência, remove a transação por `CommitmentPaymentId` e remove o pagamento (`FinancialCommitmentService.cs:153-188`). Isso aumenta o saldo atual porque a despesa deixa de existir. A operação é consistente no mesmo commit, mas é uma exclusão física e não uma transação de estorno.
7. **Repetidos, concorrentes ou parcialmente concluídos?** A combinação de lock por compromisso dentro do processo, `Serializable`, índice único por compromisso/parcela, índice único por ocorrência e transação atômica reduz duplicidade. A proteção por `SemaphoreSlim` não coordena múltiplas instâncias da API; a garantia definitiva deve vir do banco/constraint e de um fluxo idempotente por ocorrência. A unidade transacional evita um `CommitmentPayment` sem `Transaction` ou vice-versa. O tratamento no `catch` deve ser revisado: ele limpa o tracker e tenta inferir concorrência comparando `PaidInstallments`, o que é menos claro que reler por ocorrência/constraint.

### Mudança necessária no pagamento

`RegisterPaymentAsync` deve deixar de consultar `AllocatedAmount`, deixar de chamar `FinancialCommitment.RegisterPayment` na forma que consome reserva e registrar diretamente o valor da ocorrência. Uma forma segura é:

- determinar uma ocorrência não paga;
- bloquear/reler essa ocorrência e o compromisso;
- se já paga, retornar o resultado existente (idempotência);
- criar `CommitmentPayment` e `Transaction(Expense)` vinculados;
- atualizar status da ocorrência e contadores dentro da mesma transação;
- garantir unicidade por ocorrência/parcela no banco;
- fazer o desfazimento estornar exatamente a transação vinculada e devolver a ocorrência ao estado `Pending`/`Planned`.

O valor não deve ser descontado por `CommitmentPayment` separadamente: só a `Transaction` afeta o saldo.

O pagamento manual com saldo insuficiente deve exigir `confirmInsufficientBalance = true`. O valor padrão `false` deve ser aplicado também quando o campo for omitido. Sem confirmação, o erro deve identificar `currentBalance`, `paymentAmount` e `insufficientAmount`. A checagem deve ocorrer novamente dentro da transação, depois do lock/releitura do compromisso e do saldo, para que requisições concorrentes não usem o mesmo saldo observado antes do commit. A confirmação autoriza o saldo negativo, mas não cria uma baixa adicional: a despesa vinculada continua sendo a única saída financeira.

### Rastreabilidade das reversões

O comportamento atual remove fisicamente o pagamento e a `Transaction`. Para novos dados, a regra aprovada é preservar a despesa original e registrar um estorno auditável:

- manter a `Transaction(Expense)` original imutável;
- criar uma nova movimentação compensatória de tipo `Income`, com valor igual, data do estorno e referência ao pagamento/transação original;
- marcar `CommitmentPayment` como revertido, registrando `ReversedAt`, ator e motivo, ou persistir evento equivalente com vínculo único ao pagamento;
- manter ambas as operações no histórico do frontend, identificando claramente a despesa como “pagamento estornado” e a entrada como “movimentação de estorno”;
- manter a despesa original no histórico e neutralizar seu efeito econômico com a compensatória; consultas de saldo devem considerar o par de operações como líquido zero, sem apagar sua evidência;
- impedir mais de um estorno para o mesmo pagamento com constraint única no banco e idempotência no comando.

O impacto líquido do par original + compensação deve ser zero após a reversão: a despesa original permanece contabilmente visível e a entrada compensatória a neutraliza, sem crédito líquido adicional. A parcela deve voltar a `Pending`/`Planned`, `PaidInstallments` deve ser decrementado exatamente uma vez e a previsão deve voltar a considerar a ocorrência como pendente quando ela ainda estiver no horizonte aplicável.

Pagamentos já revertidos fisicamente pelo fluxo legado devem ser inventariados antes da migração. Não devem ser recriados nem receber estornos artificiais sem evidência. A deleção física pode ser mantida apenas como compatibilidade de leitura histórica, nunca como comportamento novo.

## 5. Previsão, resumo e cálculo

`FinancialForecastService.cs:64-132` constrói detalhes de compromissos consumindo `AllocatedAmount`, calcula `totalAllocated`, `CalculateReserveMetrics` e cobertura global/mensal. Esse trecho deve passar a expor parcelas futuras não pagas e seus valores previstos; o saldo projetado deve ser calculado pelos eventos planejados e as despesas efetivamente pagas devem aparecer como realizadas.

`ForecastCalculator.cs:45-54` já separa eventos realizados e planejados e acumula o fechamento mensal; `FinancialDomainCalculator.CalculatePeriodMetrics` já separa resultado real de resultado projetado (`FinancialDomainCalculator.cs:19-30`). Esses componentes devem permanecer e virar a base da nova regra.

`FinancialSummaryService.GetMonthlyAsync` (`FinancialSummaryService.cs:42-133`) ainda calcula `occurrenceAllocated`, `allocated` e `missing` (`:77-96`), mas já separa transações realizadas de futuras e usa `ForecastEventNormalizer` para projeção (`:97-133`). A refatoração deve retirar a alocação e conservar: valor devido, valor pago, status, receitas previstas, despesas previstas, resultado realizado e fechamento projetado.

## 6. Persistência, relacionamentos e migration

### Estrutura atual

- `financial_commitments.AllocatedAmount` foi criado na migration inicial `Aloca.Api/Data/Migrations/20260916002731_InitialFinancialDomain.cs` e permanece no snapshot (`AlocaDbContextModelSnapshot.cs:196-263`). Há constraint `ck_financial_commitments_allocated_amount_non_negative` e índice composto por `IsFullyCommitted, Priority` (`FinancialCommitmentConfiguration.cs:11-18, 30-47`).
- `commitment_payments` foi criado/expandido em `20260917183605_AddCommitmentPayments.cs`; tem FK para `financial_commitments`, valor positivo e unicidade por compromisso/parcela (`CommitmentPaymentConfiguration.cs:11-27`).
- `transactions.CommitmentPaymentId` e o relacionamento da transação com pagamento vieram de `20260921154225_AddCommitmentPaymentTransactions.cs`; o índice é único (`TransactionConfiguration.cs:43-49`). Essa relação é essencial no novo modelo e deve permanecer.
- `financial_commitment_occurrences` e os vínculos de ocorrência foram introduzidos em `20260923222418_AddFinancialCommitmentOccurrences.cs`; há unicidade por compromisso/data e FK de pagamento com `SetNull` (`FinancialCommitmentOccurrenceConfiguration.cs:11-19`). Devem permanecer.
- `AlocaDbContext.cs:27-34, 44-60` registra e filtra por conta todas essas entidades; a remoção de alocação não deve quebrar isolamento multi-tenant.

### Dados que devem ser preservados

Preservar integralmente:

- `transactions`, inclusive despesas já criadas por pagamentos;
- `commitment_payments`, `FinancialCommitmentOccurrence` e seus IDs;
- compromissos, agenda, pagamentos automáticos, categorias, receitas e saldo inicial;
- vínculo `Transaction.CommitmentPaymentId` e `Transaction.FinancialCommitmentId`.

`AllocatedAmount` histórico não é uma movimentação financeira. Ele não deve ser convertido automaticamente em despesa, pois isso descontaria dinheiro de novo. Se for removido, registrar o valor histórico em backup/arquivo de auditoria ou criar uma migration que zere o campo depois de congelar/exportar a informação, sem criar transações.

### Estratégia segura para produção

1. Fazer backup e medir inconsistências: reservas maiores que saldo, pagamentos sem transação, transações de pagamento sem pagamento, duplicidades e ocorrências pagas sem `CommitmentPayment`.
2. Implantar primeiro uma versão compatível que aceite os dados antigos, mas escreva pagamentos novos sem depender de alocação; manter leitura legada apenas durante a transição.
3. Reconciliar dados históricos de pagamento com suas transações, sem inventar movimentações para reservas.
4. Publicar contratos novos e migrar o frontend.
5. Somente depois remover `AllocatedAmount`, constraints/índice de alocação e tabelas/colunas exclusivamente de alocação numa migration nova. Não editar migrations já aplicadas.
6. Manter `commitment_payments` e `financial_commitment_occurrences`; a migration de remoção não deve apagá-los.
7. Fazer rollout com verificação de invariantes antes/depois: saldo contábil, contagem/valor de despesas, unicidade de pagamentos, pagamentos automáticos e reversões.

Risco principal: contas existentes com `AllocatedAmount` representam intenção de reserva, não dinheiro efetivamente saído. Zerar esse campo pode liberar visualmente cobertura, mas não deve alterar o saldo atual. A UI precisa comunicar que o estado antigo era planejamento de cobertura e que o novo estado usa pagamentos efetivos.

## 7. Impactos no frontend

`frontend/src/services/api.js:95-99` expõe as cinco operações de alocação e deve removê-las. `:100-103` expõe os endpoints de pagamento/reversão e deve permanecer, com semântica sem pré-condição de reserva.

As telas/componentes rastreados que contêm o comportamento de planejamento, dashboard, previsão e movimentações incluem:

- `frontend/src/features/planning/PlanningPage.jsx`;
- `frontend/src/features/movements/CommitmentsFeature.jsx` e `MovementsArea.jsx`;
- `frontend/src/features/movements/components/MovementsContent.jsx`, `MovementFormModal.jsx`, `MovementsSummary.jsx` e `MovementsTabs.jsx`;
- `frontend/src/features/dashboard/DashboardPage.jsx`;
- `frontend/src/features/forecast/ForecastPage.jsx` e componentes `Forecast*`;
- `frontend/src/features/settings/SettingsComponents.jsx`;
- `frontend/src/utils/financial.js`;
- `frontend/src/services/api.js`.

No estado atual do worktree, vários desses arquivos aparecem removidos/modificados; isso é pré-existente e não foi alterado nesta auditoria. A matriz de impacto deve ser revisada contra a versão efetivamente publicada do frontend.

Alterações de produto esperadas:

- remover botões, modais, tooltips e ações de alocar, desalocar, liberar reserva e cobrir parcela;
- em obrigações e detalhes de parcela, mostrar `planned/pending/paid/cancelled`, valor devido, valor pago e ação de pagamento;
- no dashboard, trocar “saldo disponível/livre” baseado em reserva por saldo atual e, se desejado, “obrigações futuras” claramente separado;
- na previsão, manter despesas futuras e status previsto, mas retirar cobertura percentual e valor alocado;
- em movimentações, a despesa criada pelo pagamento deve aparecer uma vez e permanecer vinculada à obrigação;
- em configurações, não apresentar configuração de reserva/proteção;
- atualizar `docs/FRONTEND_INTEGRATION.md`, `docs/API_ENDPOINTS.md` e `docs/API_GAPS.md`.

## 8. Componentes a remover, preservar e refatorar

### Remover

- rotas de allocations/deallocations no controller;
- métodos de alocação em `FinancialCommitmentService`;
- `FinancialAllocationService`, `FinancialAllocationReconciliationService` e `FinancialAllocationConcurrency`;
- `FinancialAllocationDtos.cs`;
- `AllocatedAmount` e constraint/índice exclusivamente associados, após migration segura;
- fórmulas `Reserved`, `Unallocated`, `CoverageDeficit`, `Free` e aliases de reserva;
- campos de reserva/cobertura dos DTOs e chamadas equivalentes do frontend;
- reconciliação automática acionada por `TransactionService`.

### Preservar

- `FinancialCommitment`, agenda e ocorrências;
- `CommitmentPayment` e suas constraints;
- `Transaction`, `CommitmentPaymentId`, `FinancialCommitmentId` e índice único;
- `FinancialBalanceService` para saldo real, simplificado;
- `FinancialDomainCalculator.CalculatePeriodMetrics` e `ForecastCalculator`;
- `RecurringIncomeService`, ocorrências de receita e processamento automático de receitas;
- locks/concorrência de pagamento, mas com garantia definitiva no banco;
- resumo mensal, previsão, categorias, saldo inicial e isolamento por conta, com contratos revisados.

### Refatorar

- `RegisterPaymentAsync` e `ReverseLatestPaymentAsync` para idempotência por ocorrência e sem reserva;
- `ProcessDueAsync` para processar vencimentos conforme a política de pagamento automático, sem warning de “faltam reservas”;
- `FinancialCommitment` para separar estado de compromisso de estado contábil;
- `FinancialCommitmentResponse`, `FinancialSummaryResponse` e `FinancialForecastDtos`;
- `FinancialSummaryService` e `FinancialForecastService` para distinguir realizado, planejado, pendente e projetado;
- controllers, documentação e frontend.

## 9. Testes e riscos

`tests/Aloca.Api.Tests/FinancialAllocationTests.cs` é dedicado ao sistema removido e deverá ser substituído por testes de saldo/pagamento; `FinancialCommitmentTests.cs` contém muitas expectativas explícitas de `Allocate`, cobertura e consumo/restituição de reserva; `FinancialForecastCoverageTests.cs` cobre `TotalReservado`, `SaldoNaoAlocado` e cobertura; `AutomaticProcessingTests.cs` valida atualmente a exigência de reserva, criação de despesa, idempotência e reversão. Esses testes não podem ser apenas excluídos: os testes de criação de transação, atomicidade, saldo, repetição, concorrência e reversão devem ser preservados/reformulados.

Riscos relevantes:

- **dupla contagem:** uma ocorrência com pagamento ativo deve ser excluída dos eventos futuros; sua `Transaction` efetiva não pode ser somada novamente como despesa planejada;
- **duplicidade:** múltiplas instâncias não compartilham `SemaphoreSlim`. A garantia deve estar no banco: unicidade por ocorrência em `CommitmentPayment`, unicidade por `CommitmentPaymentId` na despesa e unicidade do estorno por pagamento. Em conflito, reler o registro vencedor e retornar resultado idempotente, sem inserir nova despesa;
- **migração histórica:** transformar reservas em despesas altera incorretamente saldo;
- **contrato quebrado:** frontend e clientes usam aliases e campos de cobertura;
- **pagamento automático:** somente obrigações explicitamente autorizadas podem ser processadas, e o saldo deve ser revalidado dentro da transação para impedir que o job ultrapasse o saldo real disponível;
- **reversão:** preservar a despesa original e registrar uma transação compensatória/estado de estorno. Saldos devem considerar apenas pagamentos ativos, sem contar despesa original e estorno como duas despesas;
- **saldo ao cadastrar/vencer:** `CreateAsync`, `EnsureOccurrencesAsync` e a transição para `Pending` não podem criar `Transaction`; somente pagamento efetivo gera despesa;
- **previsão paga:** `ForecastEventNormalizer` deve excluir ocorrências com pagamento ativo, e a projeção deve continuar partindo do saldo atual já contendo todas as transações efetivas até a data de negócio;
- **confirmação manual:** `confirmInsufficientBalance` ausente equivale a `false`; sem confirmação, nenhuma escrita pode ocorrer. Com confirmação, a revalidação transacional permite saldo negativo;
- **estorno idempotente:** uma segunda solicitação de estorno deve retornar o estorno já existente ou um resultado determinístico, sem nova movimentação compensatória;
- **parcela após estorno:** uma parcela revertida não pode permanecer `Paid`, nem ser excluída permanentemente da previsão quando ainda estiver pendente;
- **escopo de ocorrência:** o endpoint genérico paga a primeira pendente; após a migração deve garantir que a ocorrência escolhida seja a única afetada;
- **edição/exclusão:** transações vinculadas a pagamento continuam não editáveis/excluíveis diretamente (`TransactionService.cs:140-143, 164-170`). Essa proteção deve permanecer.

### Dependências indiretas que precisam ser tratadas como parte da remoção

Além das referências diretas a `AllocatedAmount`, a remoção fica bloqueada pelos seguintes acoplamentos:

- `FinancialCommitment` recebe `allocatedAmount` e `isFullyCommitted` nos dois construtores; os testes e o `FinancialCommitmentService.CreateAsync/UpdateAsync` ainda montam o agregado com esses argumentos.
- `FinancialCommitmentConfiguration` persiste `AllocatedAmount`, cria `ck_financial_commitments_allocated_amount_non_negative` e indexa `IsFullyCommitted, Priority`. O índice deve ser removido ou redesenhado para a ordenação realmente necessária.
- Todos os snapshots/designers de migrations carregam essa coluna e constraint porque refletem o modelo histórico. Eles não devem ser editados manualmente; a remoção deve ser uma migration nova gerada a partir do modelo final.
- `FinancialAllocationService.BuildPlanAsync` filtra `IsFullyCommitted`; portanto, apagar apenas os endpoints deixa uma classe de negócio ainda capaz de alterar reservas.
- `FinancialAllocationReconciliationService` é uma dependência opcional de `FinancialCommitmentService`, é registrada no DI e é instanciada também diretamente por `TransactionService` e pelos testes.
- `FinancialCommitmentResponse`, `FinancialSummaryResponse`, `MonthlyCommitmentResponse` e `FinancialForecastResponse` têm campos de cobertura que podem manter o conceito vivo mesmo depois da remoção do serviço.
- `FinancialCommitmentOccurrence` e `CommitmentPayment` são dependências que devem permanecer: pagamento, reversão, processamento automático e os índices únicos dependem delas, mas seus estados não devem mais significar “coberto por reserva”.
- O filtro `isFullyCommitted` do `GET /api/financial-commitments` e o campo correspondente nos requests são contratos públicos; devem ser removidos ou explicitamente redefinidos antes da exclusão da propriedade.
- Os testes `ApiServicesTests` constroem `TransactionService` com reconciliação explícita; sua assinatura precisa ser migrada junto com o DI, ou a compilação falhará mesmo sem chamadas de alocação em runtime.

### Invariantes de saldo para a aprovação arquitetural

Durante a implementação, cada etapa deve demonstrar as seguintes propriedades por conta:

```text
saldo_atual = saldo_inicial + soma(receitas efetivas) - soma(despesas efetivas)
```

- criar ou editar uma obrigação não altera `saldo_atual`;
- criar uma ocorrência planejada não cria `Transaction`;
- um pagamento aprovado produz exatamente um `CommitmentPayment` e exatamente uma `Transaction(Expense)`;
- a soma das despesas vinculadas a pagamentos é igual à soma dos pagamentos ativos, sem conversão de `AllocatedAmount`;
- uma reversão remove/estorna apenas a transação vinculada ao pagamento revertido e reabre a mesma ocorrência;
- repetir o mesmo comando de pagamento não cria nova despesa;
- falhar em qualquer ponto não deixa pagamento, ocorrência ou transação parcialmente persistidos.

Essas invariantes devem ser verificadas em PostgreSQL, inclusive com duas instâncias/processos concorrentes. O `SemaphoreSlim` é apenas uma otimização local e não pode ser tratado como garantia de unicidade em produção.

## 10. Plano de implementação

### Etapa 0 — testes de regressão e contrato de transição (antes de mudar o domínio)

**Arquivos:** `FinancialAllocationTests.cs`, `FinancialCommitmentTests.cs`, `AutomaticProcessingTests.cs`, `FinancialSummaryTests.cs`, `FinancialForecastCoverageTests.cs`, testes de integração PostgreSQL e contratos documentados em `docs/API_ENDPOINTS.md`.

**Ações:** congelar o comportamento financeiro atual com testes de saldo, criação de obrigação, vencimento, pagamento manual, pagamento automático autorizado/não autorizado, saldo insuficiente, repetição concorrente em múltiplas conexões, rollback e reversão. Adicionar testes de contrato que aceitem os novos estados (`planned`, `pending`, `paid`, `reversed`) enquanto aliases legados ainda são fornecidos.

**Aceitação:** existe uma suíte executável antes da refatoração; uma obrigação criada ou vencida nunca gera transação; um pagamento gera uma única despesa; uma reversão é rastreável; e clientes antigos continuam recebendo uma resposta compatível durante a janela de transição.

### Etapa 1 — preparação e regressão

**Arquivos:** todos os testes de allocation, commitment, forecast, summary, automatic processing; scripts de integração PostgreSQL; `docs/API_ENDPOINTS.md`.

**Ações:** inventariar dados em produção, criar invariantes e testes de saldo; adicionar casos de pagamento repetido, concorrente, falha transacional e reversão. Essa etapa complementa os testes congelados na Etapa 0; não substitui a execução deles.

**Risco/dependência:** dados legados e expectativa de cobertura; exige backup e ambiente com PostgreSQL.

**Aceitação:** baseline documentado; nenhum pagamento existente perde sua transação; casos de duplicidade têm resultado determinístico.

### Etapa 2 — refatoração do modelo financeiro

**Arquivos:** `FinancialBalanceService.cs`, `FinancialDomainCalculator.cs`, `FinancialSummaryService.cs`, `FinancialForecastService.cs`, `ForecastCalculator.cs` e DTOs correspondentes.

**Ações:** saldo contábil somente por transações; separar obrigações futuras; remover métricas de reserva.

**Risco/dependência:** mudanças no JSON e na UI.

**Aceitação:** cadastro/vencimento de obrigação não altera saldo; saldo é inicial + receitas − despesas; previsão ainda inclui pendências.

### Etapa 3 — processamento de pagamentos

**Arquivos:** `FinancialCommitmentService.cs`, `FinancialCommitment.cs`, `CommitmentPayment.cs`, `FinancialCommitmentOccurrence.cs`, `Transaction.cs`, configurações e testes automáticos.

**Ações:** remover pré-condição de alocação; criar despesa uma vez por pagamento; usar transação de banco, constraint e idempotência por ocorrência; desfazer a movimentação correspondente de forma atômica.

**Risco/dependência:** pagamento manual exige confirmação explícita quando o saldo é insuficiente; automático exige autorização da obrigação e bloqueio quando o saldo real não cobre a parcela. A revalidação deve ocorrer dentro da transação para concorrência entre instâncias.

**Aceitação:** um pagamento reduz saldo exatamente uma vez; repetição retorna estado existente; falha não deixa metade da operação; reversão preserva a despesa original, registra seu estorno uma única vez e restaura saldo e pendência exatamente uma vez.

### Etapa 4 — remoção de serviços e endpoints

**Arquivos:** `FinancialCommitmentsController.cs`, `FinancialCommitmentService.cs`, `FinancialAllocationService.cs`, `FinancialAllocationReconciliationService.cs`, `FinancialAllocationConcurrency.cs`, `Program.cs`, `TransactionService.cs`.

**Ações:** remover cinco rotas, DI e reconciliação; retirar chamadas de alocação.

**Risco/dependência:** clientes antigos receberão 404; planejar versionamento/depreciação se necessário.

**Aceitação:** nenhuma rota de alocação é publicada; endpoints de compromisso, pagamento, transação e previsão funcionam sem referência a alocação.

### Etapa 5 — entidades e persistência

**Arquivos:** `FinancialCommitment.cs`, `FinancialCommitmentConfiguration.cs`, `AlocaDbContext.cs`, migration nova e snapshot gerado.

**Ações:** preservar pagamentos/ocorrências/transações; retirar coluna/constraint/índice de alocação somente após auditoria e rollout compatível.

**Risco/dependência:** produção pode possuir dados históricos e clientes em versões antigas.

**Aceitação:** migration reversível/ensaiada em cópia; nenhum dado financeiro histórico é apagado; invariantes de FK e unicidade continuam válidas.

### Etapa 6 — DTOs e contratos

**Arquivos:** `FinancialAllocationDtos.cs`, `FinancialCommitmentDtos.cs`, `FinancialSummaryResponse.cs`, `FinancialForecastDtos.cs`, `docs/API_ENDPOINTS.md`, `docs/API_GAPS.md`.

**Ações:** retirar campos de cobertura/reserva; introduzir nomes explícitos de realizado/planejado/pago/pendente; manter aliases e compatibilidade de resposta durante a migração do frontend, removendo-os somente após todos os consumidores serem migrados.

**Risco/dependência:** consumidores externos e frontend.

**Aceitação:** OpenAPI/contratos não apresentam ações ou campos de alocação; valores de pagamento e transação seguem vinculados.

### Etapa 7 — testes

**Arquivos:** `FinancialAllocationTests.cs`, `FinancialCommitmentTests.cs`, `FinancialForecastCoverageTests.cs`, `AutomaticProcessingTests.cs`, `FinancialSummaryTests.cs`, `FinancialForecastControllerTests.cs`, integração PostgreSQL.

**Ações:** remover expectativas de cobertura e adicionar testes de regra nova, concorrência, rollback, idempotência, saldo e forecast.

**Risco/dependência:** testes atuais codificam deliberadamente o comportamento antigo.

**Aceitação:** suíte unitária e PostgreSQL passam; testes verificam saldo antes/depois e ausência de duplicidade.

### Etapa 8 — frontend, documentação e integração

**Arquivos:** `frontend/src/services/api.js`, telas de dashboard, planejamento, obrigações, movimentações, previsão e configurações; `docs/FRONTEND_INTEGRATION.md`, `docs/APPLICATION_FLOWS.md`, `README.md`.

**Ações:** remover botões/ações de reserva; trocar cards por saldo atual e compromissos previstos; manter pagamento e reversão; publicar guia de migração.

**Risco/dependência:** estado atual do worktree possui alterações prévias no frontend; validar contra o artefato implantado.

**Aceitação:** usuário não vê alocar/desalocar/proteger; registrar pagamento cria uma única despesa visível; dashboard e previsão não mudam saldo ao cadastrar obrigação.

## Regras ainda indefinidas e riscos residuais

Com as decisões desta revisão, não há regra de negócio pendente que impeça iniciar a implementação. `confirmInsufficientBalance` é a confirmação explícita padrão-falsa para pagamentos manuais, e estornos preservam a operação original com movimentação compensatória visível e idempotente.

Riscos que não impedem a implementação, mas exigem validação em PostgreSQL são: corrida entre um pagamento automático e outra despesa, migração de registros já revertidos fisicamente e compatibilidade de consumidores que ainda dependem dos aliases de alocação. Nenhuma reserva histórica deve ser convertida em despesa ou alterar o saldo atual.

## Resposta final

Sim. É possível eliminar completamente o sistema de alocações sem prejudicar o registro de pagamentos. O modelo aprovado fica definido assim: pagamentos manuais são o padrão e podem ultrapassar o saldo somente após confirmação; pagamentos automáticos exigem autorização explícita e nunca ultrapassam o saldo real; cadastro e vencimento não alteram o saldo; previsões excluem ocorrências já pagas; reversões preservam a despesa original e registram estorno; constraints e idempotência no banco impedem duplicidade em múltiplas instâncias; e todo o histórico financeiro é preservado.
