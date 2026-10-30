# Fluxos funcionais da aplicação

Os passos abaixo descrevem o comportamento observado nos controllers/services. “Frontend deve” é recomendação de integração; o restante é comportamento confirmado.

## 1. Primeiro acesso e conta local

1. O usuário abre a aplicação.
2. Frontend chama `GET /api/account/current`.
3. O middleware cria ou recupera `aloca.device`, tenta restaurar a sessão e, se necessário, localiza/cria uma conta local.
4. A resposta traz `accounts`, `current`, `limit` e `requiresLogin`.
5. Frontend carrega resumo, grupos, transações, recorrentes, compromissos e previsão para `current`.

Erros: `429` deve aguardar; `5xx` deve mostrar indisponibilidade. A sessão é por cookie, então o cliente não deve armazenar token próprio.

## 2. Login e troca de conta

1. Usuário envia e-mail/senha para `POST /api/account/login`.
2. Backend valida hash, cria vínculo dispositivo-conta se necessário, atualiza uso e emite `aloca.auth`.
3. Frontend invalida todo estado financeiro anterior e recarrega dados.
4. Para trocar entre contas já vinculadas, chama `POST /api/account/switch/{accountId}` e repete a invalidação.

Erros: `401` credenciais inválidas; `409` limite de quatro contas; `404` conta não vinculada no switch.

## 3. Proteção e recuperação de senha

Proteção: conta local → `POST /api/account/protect` com nome, e-mail, senha e confirmação → backend valida duplicidade, grava hash e renova sessão.

Recuperação: formulário → `POST /api/account/password-recovery/request` → sempre mostrar a mensagem genérica; usuário usa token recebido → `POST /api/account/password-recovery/reset` → em sucesso `204`, encaminhar para login. Token inválido/expirado ou senhas incompatíveis retornam `400`.

## 4. Cadastro de grupo e transação

1. Carregar `GET /api/groups` para o select.
2. Usuário confirma → `POST /api/transactions` com `type` e `categoryId`.
3. Backend valida DTO, existência do grupo, cria transação e executa reconciliação de alocações.
4. Resposta `201` contém a transação completa.
5. Frontend atualiza lista paginada e refaz resumo/forecast/compromissos.

Para edição, `PUT /api/transactions/{id}` mantém o tipo original; mudança de tipo retorna `400`. Pagamentos de compromisso devem usar o fluxo do compromisso, não a edição/exclusão genérica.

## 5. Entrada recorrente e recebimento

1. Criar com `POST /api/recurring-incomes`; o backend valida grupo, salva definição e gera ocorrências.
2. Consultas de lista/detalhe sincronizam agenda até 24 meses e processam ocorrências vencidas com `automaticProcessing`.
3. Uma ocorrência planejada pode ser recebida por `POST /api/recurring-incomes/occurrences/{occurrenceId}/receive`.
4. O backend cria transação de entrada, marca a ocorrência `Received` e reconcilia.
5. Frontend atualiza recorrentes, transações, resumo mensal e forecast.

Pausar usa `POST .../pause`; ativar usa `POST .../activate`. A projeção agregada de 12 meses vem de `GET /api/recurring-incomes/projection`.

## 6. Compromisso e pagamento

1. Frontend lista com `GET /api/financial-commitments`, opcionalmente usando `isCompleted`.
2. Criar/editar gera ou reconcilia ocorrências em horizonte de 24 meses.
3. Para pagar, chama `POST .../{id}/payments` ou paga uma ocorrência específica.
4. Sem saldo suficiente, o backend retorna `422` e exige `confirmInsufficientBalance: true` para permitir saldo negativo.
5. Backend cria uma única transação de despesa vinculada ao pagamento e marca a ocorrência como paga.
6. Para reverter, usa `DELETE .../payments/latest` ou a rota de ocorrência; o backend cria um estorno auditável.

Erros: `404` id/ocorrência; `409` operação incompatível; `422` em certos erros de alocação; `400` quando o controller mapeia o domínio como entrada inválida. O frontend deve usar a resposta completa, não assumir que apenas o campo clicado mudou.

## 7. Dashboard e fechamento mensal

1. Chamar `GET /api/financial-summary` para saldo atual.
2. Chamar `GET /api/financial-summary/monthly?period=YYYY-MM-01` para o mês exibido.
3. Backend combina transações, ocorrências recorrentes, compromissos, pagamentos e saldo atual; também calcula saldo final estimado.
4. Frontend exibe realizado, previsto, cobertura, urgentes e compromissos.

Não há chamada de “fechar mês”; o período é apenas query string e o processamento automático pode materializar entradas vencidas durante a consulta.

## 8. Ajuste de saldo e configuração

1. `GET /api/financial-settings` carrega saldo inicial.
2. `PUT /api/financial-settings` altera o saldo inicial e reconcilia.
3. Para corrigir saldo corrente, `POST /api/financial-settings/current-balance-adjustment` com `newBalance`.
4. Se houver diferença, backend cria uma transação especial `Ajuste manual de saldo` na data de negócio; retorna `FinancialSummaryResponse`.

## 9. Previsão financeira

1. Frontend chama `GET /api/financial-forecast?from=YYYY-MM-01&months=N`.
2. Backend normaliza eventos de transações, ocorrências recorrentes e parcelas de compromissos.
3. Calcula cada mês com saldo de abertura/fechamento, entradas/saídas realizadas e planejadas, compromisso, alocação, cobertura e itens.
4. Frontend renderiza meses e detalhe de eventos.

`months` permitido: 1–36. `from` deve ser primeiro dia do mês.

## 10. Exclusão e limpeza

Excluir grupo apenas desassocia o rótulo. Excluir recorrente arquiva a definição e remove ocorrências não recebidas. Excluir transação de pagamento é bloqueado; deve-se desfazer pelo compromisso. Excluir conta remove os dados financeiros da conta, vínculos de dispositivo e avatar e então inicia uma nova sessão, portanto o frontend deve atualizar a identidade imediatamente.
