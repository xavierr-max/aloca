# Auditoria de preservação de estado

## Inventário

| Estado | Onde fica | Persistência | Comportamento após refresh |
| --- | --- | --- | --- |
| Rota principal | `App.view`, derivado de `window.location.hash` | URL hash | Mantém a rota atual |
| Mês selecionado | `App.selectedMonth` | `sessionStorage` (`aloca-selected-month`) | Mantém o mês |
| Período da projeção | `App.projectionMonths` | `localStorage` (`aloca-projection-months`) | Mantém o período |
| Objetivo | `App.commitmentObjective` e `CommitmentObjective.draft` | `localStorage` (`aloca-commitment-objective`) | Mantém o texto |
| Busca e filtros de compromissos | `App.searchInput`, `App.search`, `App.filters` | Estado React | Mantém busca, grupo, status, cobertura, pagamento, flags e ordenação |
| Grupos recolhidos | `App.collapsed` | Estado React | Mantém accordions por grupo |
| Aba de movimentações | `IncomeManagement.typeFilter` | Estado local React | Mantém a aba enquanto os dados são atualizados |
| Filtros de movimentações | `AllMovementsSection` e `RecurringIncomeList` | Estado local React | Mantém busca, grupo, período, ordenação e status |
| Recorrência selecionada | `RecurringIncomeList.selected` | Estado local React | Mantém o drawer e sincroniza o item atualizado |
| Drawer de compromisso | `CommitmentCard.detailsOpen` | Estado local React | Permanece aberto durante mutations/refetch |
| Rascunho de reserva | `CommitmentDetailsDrawer.amount` | Estado local React | Permanece até a mutation concluir |
| Mês destacado no gráfico | `FinancialProjectionChart.selected` | Estado local React | Permanece durante refresh; muda apenas ao trocar período ou mês |
| Modais e drawers globais | Estados de `App` e componentes de camada | Estado React | Fecham somente quando a ação fecha aquela camada |
| Tema | `ThemeProvider.theme` | `localStorage` (`theme`) | Mantém o tema |
| Paginação | Não existe no frontend atual | — | Não há reset para auditar |
| Scroll | Posição do documento/navegador | Não persistido | O refetch não desmonta mais a página; não há `reload`, `scrollTo` ou `scrollIntoView` da aplicação fora do tutorial |

## Resets encontrados

O reset redundante principal estava em `App`: `refresh()` fazia `setLoading(true)` e o render substituía toda a página pelo loading. Cada mutation e cada refetch desmontava os componentes das telas. Isso reiniciava estados locais, fechava `<details>`, drawers e seleções e apagava filtros internos.

O fluxo foi separado em carregamento inicial e atualização de dados. O loading só substitui a página antes do primeiro carregamento; depois disso, `refresh()` atualiza server state sem desmontar UI state.

O drawer de recorrência também fazia `setSelected(null)` ao pausar/reativar e ao salvar uma edição. Esse fechamento foi removido para manter o item em contexto; o item selecionado agora é sincronizado com a lista retornada pelo backend. Excluir a recorrência ainda fecha o drawer porque o item deixou de existir.

Não foram encontrados `window.location.reload`, `location.href`, `reset()` indevido, keys instáveis, `Date.now()`, `Math.random()` ou efeitos que redefinam filtros/mês/abas após refetch.

## Matriz de preservação

| Cenário | Estado que deve permanecer | Resultado esperado |
| --- | --- | --- |
| Selecionar grupo, pesquisar e editar compromisso | Grupo, busca, ordenação e grupo expandido | Dados atualizam e o mesmo contexto permanece |
| Pesquisar e marcar parcela como paga | Busca e filtros | Pesquisa permanece após refresh |
| Escolher outro mês e alocar valor | Mês selecionado | Mês permanece após a projeção ser atualizada |
| Abrir accordion e editar item | Accordion e drawer | Accordion/drawer permanecem montados durante o refresh |
| Abrir página de movimentações e editar saída | Aba, busca, grupo, mês e ordenação | Todos permanecem após salvar |
| Abrir aba Recorrentes e editar recorrência | Aba, busca e status | Drawer continua aberto em modo de visualização com dados novos |
| Pausar ou reativar recorrência | Drawer, busca e status | Drawer continua aberto e o status é atualizado |
| Receber ocorrência | Aba, busca, status e seleção | Lista atualiza sem voltar para o estado inicial |
| Excluir item filtrado | Filtros e contexto da lista | Apenas o item removido; a camada de confirmação fecha |
| Rolar a página e abrir/fechar modal ou drawer | Scroll e contexto principal | Não há remount global nem salto causado por refresh |

