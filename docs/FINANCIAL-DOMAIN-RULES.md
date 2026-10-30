# Contrato oficial do domínio financeiro

Este documento é a fonte documental única das regras financeiras da aplicação. Os serviços e DTOs devem usar os mesmos nomes e fórmulas. O modelo de alocações não faz parte do contrato atual.

## Conceitos

- **Saldo atual**: dinheiro que o usuário possui efetivamente agora. Só muda por ajuste manual explícito, entrada concretizada, saída concretizada ou pagamento concretizado de compromisso. Compromissos futuros e previsões não o alteram.
- **Obrigação pendente**: parcela futura ou vencida ainda não paga. É planejamento e não altera o saldo atual.
- **Entrada realizada**: dinheiro que efetivamente entrou.
- **Entrada prevista**: dinheiro esperado que ainda não entrou.
- **Saída realizada**: dinheiro que efetivamente saiu, incluindo pagamento concretizado de compromisso.
- **Saída prevista**: saída ou compromisso futuro ainda não concretizado.

## Fórmulas oficiais

```text
Resultado real = Entradas realizadas - Saídas realizadas
Entradas totais = Entradas realizadas + Entradas previstas pendentes
Saídas totais = Saídas realizadas + Saídas previstas pendentes
Resultado previsto = Entradas totais - Saídas totais
Saldo final estimado = Saldo atual + entradas futuras não realizadas - saídas futuras não realizadas
```

Um evento só pode ser `REALIZADO` ou `PREVISTO`. Ao ser recebido/pago, ele muda de estado e deixa de compor a soma de previstos.

## Invariantes

```text
Compromisso não pago não altera Saldo atual
Pagamento altera Saldo atual
Eventos realizados não são recontados na projeção
```

## Mapeamento atual e pendências

| Conceito | Implementação atual | Situação |
|---|---|---|
| Obrigações pendentes | `FinancialCommitmentOccurrence` | Planejamento futuro; não altera o saldo atual. |
| Saldo atual | `FinancialBalanceService` | Calculado por saldo inicial + receitas realizadas - despesas realizadas. |
| Saldo projetado | `FinancialForecastService` / `ForecastCalculator` | Inclui eventos planejados sem contar novamente transações realizadas. |
| Entradas e saídas mensais | `FinancialSummaryService`, `ForecastCalculator` | Campos genéricos (`RecurringIncomeTotal`, `CommitmentTotal`) não distinguem realizado/previsto com contrato oficial. |
| Resultado | resumo mensal e forecast | Há mais de uma interpretação de resultado mensal. |
| Saldo final estimado | resumo mensal e forecast | Precisa garantir que eventos realizados incorporados no saldo atual não sejam somados novamente. |

## Cálculos duplicados identificados

- `FinancialBalanceService` calcula o saldo atual a partir de transações.
- `FinancialForecastService` e `FinancialSummaryService` ainda precisam manter uma nomenclatura temporal uniforme para valores realizados e previstos.
- `FinancialSummaryService` calcula diretamente totais mensais e saldo final estimado.
- `ForecastCalculator` calcula totais, resultados e saldo de fechamento por mês.
- Frontend apresenta aliases e, em partes da tela de previsões, usa campos genéricos (`totalIncome`, `totalExpense`, `totalResult`, `committed`) como se fossem conceitos oficiais.

## Próximas alterações

1. Consolidar as fórmulas de saldo e projeção em um serviço de domínio puro e DTOs com nomes oficiais.
2. Separar entradas/saídas realizadas e previstas nos contratos mensais.
3. Garantir que pagamentos e recebimentos façam a transição de previsto para realizado sem duplicação.
4. Fortalecer o ajuste de saldo como evento auditável e testar histórico, pagamentos e projeções.
5. Só remover aliases e cálculos antigos após auditoria transversal e referências confirmarem que não são mais usados.

Este contrato foi introduzido sem alterar o comportamento financeiro existente.

## Persistência do saldo atual

`FinancialSettings.InitialBalance` representa somente o saldo de referência inicial da conta. Ele permanece compatível com a API existente e não é alterado quando o usuário edita o saldo atual.

O ajuste atual é feito por `POST /api/financial-settings/current-balance-adjustment`. O serviço calcula a diferença entre o saldo atual e o valor informado e persiste uma `Transaction` com descrição `Ajuste manual de saldo` e `IsBalanceAdjustment = true`. A transação é de entrada quando a diferença é positiva e de saída quando é negativa. O histórico anterior permanece intacto; o saldo passa a resultar da referência inicial, das movimentações realizadas e do ajuste explícito.

Ajustes participam do saldo atual e do ponto de partida do forecast, mas não são receita ou despesa normal: são excluídos dos campos mensais de entradas, saídas e resultados e não são enviados como eventos do forecast. Ajustes antigos identificados apenas pela descrição também são excluídos para compatibilidade.

Após um ajuste negativo, nenhuma obrigação pendente é alterada: o saldo passa a refletir o ajuste e as transações existentes.

## Obrigações e saldo

Compromissos e ocorrências representam obrigações planejadas. Eles não reservam nem descontam dinheiro do saldo atual. O saldo atual é alterado somente por transações realizadas ou por ajustes explícitos de saldo.

O pagamento cria um `CommitmentPayment` e uma única `Transaction` de despesa. O forecast pode projetar ocorrências ainda não pagas, mas uma ocorrência paga não pode voltar a ser contada como planejada.

## Classificação temporal de entradas e saídas

O contrato mensal usa `FinancialDomainCalculator.CalculatePeriodMetrics`:

```text
Entradas totais = Entradas realizadas + Entradas previstas
Saídas totais = Saídas realizadas + Saídas previstas
Resultado real = Entradas realizadas - Saídas realizadas
Resultado previsto = Entradas totais - Saídas totais
```

| Origem | Estado | Regra de período |
|---|---|---|
| `Transaction` manual de entrada | Realizado se `Date <= data de negócio`; previsto se a data for futura | `Transaction.Date` |
| `RecurringIncomeOccurrence` `Planned` | Previsto | `ScheduledDate` |
| Ocorrência recebida | Realizado somente pela transação vinculada | `Transaction.Date` |
| `Transaction` manual de saída | Realizado se `Date <= data de negócio`; previsto se a data for futura | `Transaction.Date` |
| Pagamento de compromisso | Realizado pela `Transaction` vinculada | data da transação |
| Parcela de compromisso sem pagamento | Previsto | vencimento da parcela |
| Ajuste de saldo | Não participa de entradas, saídas ou resultados | somente saldo atual |

Ocorrências recebidas ou com transação vinculada não geram um segundo evento previsto. Da mesma forma, parcelas pagas são removidas das saídas previstas.

## Ciclo de compromissos e pagamentos

O ciclo oficial é:

```text
Compromisso pendente → saída prevista
Pagamento → CommitmentPayment + Transaction Expense
Parcela paga → saída realizada e removida das previstas
Desfazer pagamento → estorno auditável, decrementa PaidInstallments e restaura a ocorrência pendente
```

Pagamento manual e automático usam `FinancialCommitmentService.RegisterPaymentAsync`. Pagamentos manuais com saldo insuficiente exigem confirmação explícita. O processamento automático não confirma saldo negativo e mantém a ocorrência pendente quando o saldo não cobre o valor integral.

Transações vinculadas a `CommitmentPayment` são históricas e não podem ser editadas ou excluídas pelo fluxo genérico de movimentações. A operação correta é desfazer o pagamento pelo compromisso. Compromissos com pagamentos históricos também não são excluídos diretamente, evitando apagar o vínculo lógico e deixar movimentações reais órfãs.

Datas iniciais são protegidas após pagamento. Valores pagos permanecem em `CommitmentPayment.Amount` e na transação histórica; alterações posteriores do compromisso afetam a agenda futura. O modelo ainda usa um `InstallmentAmount` único para gerar parcelas futuras, portanto valores diferentes por parcela exigem uma evolução estrutural para um valor próprio em cada ocorrência.

## Forecast acumulado

`FinancialForecastService` inicia a sequência no `SaldoReal` calculado para a data de negócio. Como esse saldo já incorpora todas as transações realizadas até hoje, o cálculo passa ao `ForecastCalculator` somente eventos `Planned` ainda não incorporados. Transações realizadas, pagamentos, recebimentos e ajustes são excluídos do fluxo que altera os fechamentos.

Compromissos pendentes vencidos continuam sendo obrigações futuras para fins de projeção; quando a data de vencimento já passou, seu evento é reposicionado para a data de negócio atual. O fechamento de cada mês é a abertura do mês seguinte. A ordenação permanece determinística por data contábil e `SourceId`.
