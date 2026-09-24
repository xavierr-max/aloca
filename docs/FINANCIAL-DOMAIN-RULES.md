# Contrato oficial do domínio financeiro

Este documento é a fonte documental única das regras financeiras da aplicação. Os serviços e DTOs devem usar os mesmos nomes e fórmulas; aliases antigos existem apenas por compatibilidade temporária.

## Conceitos

- **Saldo atual**: dinheiro que o usuário possui efetivamente agora. Só muda por ajuste manual explícito, entrada concretizada, saída concretizada ou pagamento concretizado de compromisso. Compromissos futuros, reservas, alocações e previsões não o alteram.
- **Saldo reservado**: parte do saldo atual explicitamente separada para compromissos futuros. Continua pertencendo ao saldo atual, não é transação e não é saída.
- **Saldo não alocado**: `max(0, saldo atual - saldo reservado)`. Não é sinônimo de saldo livre.
- **Saldo livre**: `max(0, saldo não alocado - compromissos descobertos)`. É uma métrica de segurança financeira; não é dinheiro bloqueado, não cria reserva e não altera o saldo atual.
- **Entrada realizada**: dinheiro que efetivamente entrou.
- **Entrada prevista**: dinheiro esperado que ainda não entrou.
- **Saída realizada**: dinheiro que efetivamente saiu, incluindo pagamento concretizado de compromisso.
- **Saída prevista**: saída ou compromisso futuro ainda não concretizado.

## Fórmulas oficiais

```text
Saldo não alocado = max(0, Saldo atual - Saldo reservado)
Resultado real = Entradas realizadas - Saídas realizadas
Entradas totais = Entradas realizadas + Entradas previstas pendentes
Saídas totais = Saídas realizadas + Saídas previstas pendentes
Resultado previsto = Entradas totais - Saídas totais
Saldo final estimado = Saldo atual + entradas futuras não realizadas - saídas futuras não realizadas
```

Um evento só pode ser `REALIZADO` ou `PREVISTO`. Ao ser recebido/pago, ele muda de estado e deixa de compor a soma de previstos.

## Invariantes

```text
0 <= Saldo reservado <= max(0, Saldo atual)
Saldo não alocado = max(0, Saldo atual - Saldo reservado)
0 <= Saldo livre <= Saldo não alocado
Reserva não altera Saldo atual
Compromisso não pago não altera Saldo atual
Pagamento altera Saldo atual
Eventos realizados não são recontados na projeção
```

## Mapeamento atual e pendências

| Conceito | Implementação atual | Situação |
|---|---|---|
| Saldo atual | `FinancialBalanceService` | Reconstruído de `InitialBalance` e transações; precisa evoluir para um ledger de ajustes explícitos sem semântica de saldo inicial histórico. |
| Saldo reservado | `FinancialBalanceService` / `AllocatedAmount` | Fórmula centralizada parcialmente; a alocação ainda é modelada no compromisso global. |
| Saldo não alocado | `FinancialCalculations.SaldoNaoAlocado` | Fórmula correta, mas exposta também como `AvailableForAllocation`/`UnallocatedBalance`. |
| Saldo livre | `FinancialCalculations.SaldoLivre` | Existe, porém depende de `DeficitCobertura`; forecast e resumo recalculam a composição. |
| Entradas e saídas mensais | `FinancialSummaryService`, `ForecastCalculator` | Campos genéricos (`RecurringIncomeTotal`, `CommitmentTotal`) não distinguem realizado/previsto com contrato oficial. |
| Resultado | resumo mensal e forecast | Há mais de uma interpretação de resultado mensal. |
| Saldo final estimado | resumo mensal e forecast | Precisa garantir que eventos realizados incorporados no saldo atual não sejam somados novamente. |

## Cálculos duplicados identificados

- `FinancialBalanceService` calcula reservado, não alocado, déficit e livre.
- `FinancialForecastService` recalcula os mesmos quatro valores para o resumo e para cada mês.
- `FinancialSummaryService` calcula diretamente totais mensais e saldo final estimado.
- `ForecastCalculator` calcula totais, resultados e saldo de fechamento por mês.
- Frontend apresenta aliases e, em partes da tela de previsões, usa campos genéricos (`totalIncome`, `totalExpense`, `totalResult`, `committed`) como se fossem conceitos oficiais.

## Próximas alterações

1. Consolidar as fórmulas em um serviço de domínio puro e DTOs com nomes oficiais.
2. Separar entradas/saídas realizadas e previstas nos contratos mensais.
3. Garantir que pagamentos e recebimentos façam a transição de previsto para realizado sem duplicação.
4. Fortalecer o ajuste de saldo como evento auditável e testar histórico, reservas e pagamentos.
5. Só remover aliases e cálculos antigos após auditoria transversal e referências confirmarem que não são mais usados.

Este contrato foi introduzido sem alterar o comportamento financeiro existente.

## Persistência do saldo atual

`FinancialSettings.InitialBalance` representa somente o saldo de referência inicial da conta. Ele permanece compatível com a API existente e não é alterado quando o usuário edita o saldo atual.

O ajuste atual é feito por `POST /api/financial-settings/current-balance-adjustment`. O serviço calcula a diferença entre o saldo atual e o valor informado e persiste uma `Transaction` com descrição `Ajuste manual de saldo` e `IsBalanceAdjustment = true`. A transação é de entrada quando a diferença é positiva e de saída quando é negativa. O histórico anterior permanece intacto; o saldo passa a resultar da referência inicial, das movimentações realizadas e do ajuste explícito.

Ajustes participam do saldo atual e do ponto de partida do forecast, mas não são receita ou despesa normal: são excluídos dos campos mensais de entradas, saídas e resultados e não são enviados como eventos do forecast. Ajustes antigos identificados apenas pela descrição também são excluídos para compatibilidade.

Após um ajuste negativo, `FinancialAllocationReconciliationService` pode reduzir reservas excedentes para manter `Saldo reservado <= max(0, Saldo atual)`. A ordem é determinística: preserva compromissos urgentes e remove primeiro de compromissos não urgentes, de menor prioridade e mais distantes. A reconciliação não cria transações; ela altera somente a reserva persistida.

## Reservas, não alocado e livre

Os três indicadores globais são derivados pelo `FinancialDomainCalculator.CalculateReserveMetrics` e consumidos pelo `FinancialBalanceService`:

```text
Saldo reservado = max(0, soma das reservas de compromissos ativos)
Saldo não alocado = max(0, Saldo atual - Saldo reservado)
Valor ainda sem cobertura = max(0, compromissos pendentes - Saldo reservado)
Saldo livre = max(0, Saldo não alocado - Valor ainda sem cobertura)
```

O déficit usa o total pendente bruto e subtrai a reserva uma única vez. Como o saldo não alocado já exclui a reserva, a reserva não deve ser descontada novamente em nenhum cálculo de `Saldo livre`. Os valores globais não dependem do mês selecionado. Cobertura e reserva do mês são métricas temporais distintas.

`FinancialAllocationReconciliationService` é acionado após operações que alteram o saldo ou compromissos, incluindo movimentações, ajustes e alterações de compromisso. Se o saldo cair abaixo das reservas, reduz reservas de forma determinística: compromissos urgentes são preservados; entre os demais, a redução prioriza menor prioridade e vencimento mais distante, com o identificador como desempate. A redução é persistida silenciosamente como alteração de reserva, sem criar saída ou pagamento.

Aliases técnicos mantidos por compatibilidade: `AllocatedAmount`, `AllocatedBalance`, `UnallocatedBalance`, `AvailableForAllocation`, `FreeBalance`, `AllocationDeficit`, `CoverageDeficit`, `TotalReservado`, `SaldoNaoAlocado` e `SaldoLivre`. Na interface, os nomes oficiais são usados; `Disponível`, `Alocado` e `Comprometido` não representam esses três saldos globais.

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
Reserva → dinheiro separado, ainda pertencente ao saldo atual
Pagamento → CommitmentPayment + Transaction Expense
Parcela paga → saída realizada e removida das previstas
Desfazer pagamento → remove/reverte a transação e o pagamento, decrementa PaidInstallments e restaura a reserva
```

Pagamento manual e automático usam `FinancialCommitmentService.RegisterPaymentAsync`. A cobertura é obrigatória antes do pagamento (`AllocatedAmount >= valor da parcela`). `RegisterPayment` reduz a reserva e `ReverseLatestPayment` restaura o valor pago, sem criar uma segunda movimentação.

Transações vinculadas a `CommitmentPayment` são históricas e não podem ser editadas ou excluídas pelo fluxo genérico de movimentações. A operação correta é desfazer o pagamento pelo compromisso. Compromissos com pagamentos históricos também não são excluídos diretamente, evitando apagar o vínculo lógico e deixar movimentações reais órfãs.

Datas iniciais são protegidas após pagamento. Valores pagos permanecem em `CommitmentPayment.Amount` e na transação histórica; alterações posteriores do compromisso afetam a agenda futura. O modelo ainda usa um `InstallmentAmount` único para gerar parcelas futuras, portanto valores diferentes por parcela exigem uma evolução estrutural para um valor próprio em cada ocorrência.

## Forecast acumulado

`FinancialForecastService` inicia a sequência no `SaldoReal` calculado para a data de negócio. Como esse saldo já incorpora todas as transações realizadas até hoje, o cálculo passa ao `ForecastCalculator` somente eventos `Planned` ainda não incorporados. Transações realizadas, pagamentos, recebimentos e ajustes são excluídos do fluxo que altera os fechamentos.

Compromissos pendentes vencidos continuam sendo obrigações futuras para fins de projeção; quando a data de vencimento já passou, seu evento é reposicionado para a data de negócio atual. O fechamento de cada mês é a abertura do mês seguinte. A ordenação permanece determinística por data contábil e `SourceId`.
