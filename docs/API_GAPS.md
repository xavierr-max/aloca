# Auditoria de integração e limitações

Classificação: crítica impede ou pode quebrar a integração; alta exige tratamento explícito; média afeta robustez/experiência; baixa é melhoria de contrato/documentação.

## Críticas

Nenhuma falha crítica de contrato foi confirmada na inspeção estática. A autenticação por cookie, o isolamento por conta e os endpoints principais estão implementados.

## Alta

| Prioridade | Achado | Evidência/impacto | Recomendação |
|---|---|---|---|
| Alta | Processamento de GET pode mutar dados | Listagem de recorrentes e compromissos gera ocorrências e processa automáticas; uma consulta pode alterar transações/saldos. | Documentar o efeito e/ou separar processamento em job/comando idempotente. Frontend deve refazer leituras após GETs relevantes. |
| Alta | Coleções financeiras sem paginação | Compromissos, grupos, recorrentes e ocorrências retornam coleções completas; recorrentes carregam até 120 ocorrências e compromissos horizonte de 24 meses. | Adicionar paginação/filtros quando o volume crescer; hoje o frontend precisa aceitar carga completa. |
| Alta | Fluxo de recuperação depende de configuração externa | E-mail usa Resend e `Email:Resend:ApiKey`, `FromAddress` e `PublicFrontendUrl`; falha do provedor pode virar erro não mapeado no request inicial. | Mapear falha de entrega para resposta estável e garantir configuração/monitoramento. |
| Alta | Contratos de erro não são uniformes | Há mensagens em português e inglês (`Group was not found.`, `StartDate cannot...`); alguns domínios retornam `400`, outros `409`/`422`. | Padronizar idioma, Problem Details e códigos de erro estáveis. |

## Média

| Prioridade | Achado | Impacto | Recomendação |
|---|---|---|---|
| Média | `POST` de recorrente retorna `200`, enquanto criação de transação/grupo/compromisso retorna `201` | Cliente precisa conhecer exceções ao padrão REST. | Padronizar `201 Created` com `Location`, se compatível. |
| Média | Endpoint `GET /api/account/avatar` retorna binário e falha com `404` sem envelope | Tratamento diferente das respostas JSON. | Documentar content negotiation e usar `404` consistente no cliente. |
| Média | Atualizações financeiras exigem múltiplas leituras | Resposta do compromisso é completa, mas resumo, forecast e listas relacionadas mudam por reconciliação. | Criar endpoint de snapshot/invalidação ou manter camada de query centralizada no frontend. |
| Média | Sem endpoint explícito de “cancelar ocorrência” de entrada recorrente | Há estados `Cancelled` e cancelamento interno, mas controllers expõem somente receber, pausar, ativar e excluir. | Se a UI precisar cancelar uma ocorrência individual, adicionar operação específica; não inferir cancelamento via exclusão de transação. |
| Média | Sem endpoint para excluir/editar pagamento individual fora de “latest” ou ocorrência | Frontend não pode escolher qualquer pagamento antigo diretamente. | Expor reversão por `paymentId` se o produto exigir histórico editável. |
| Média | `TransactionQueryParameters.Sort` só implementa `date` e `amount` | Outros valores silenciosamente caem em data. | Validar enum de ordenação ou documentar o fallback. |
| Média | Filtro de transações limita período a 10 anos, mas não há limite explícito semelhante em outras consultas | Consultas amplas podem ser caras. | Definir limites/horizontes uniformes. |
| Média | CORS depende de `Cors:AllowedOrigins`, ausente no `appsettings.json` mostrado | Sem origem configurada, navegador não aceitará chamadas cross-origin com credenciais. | Configurar origem exata do frontend por ambiente e testar preflight. |

## Baixa

| Prioridade | Achado | Impacto | Recomendação |
|---|---|---|---|
| Baixa | Nomes de domínio alternam “group” e “category” | Mensagens e UI podem ficar inconsistentes. | Escolher um vocabulário público único. |
| Baixa | DTOs de resumo mantêm aliases de compatibilidade (`Balance`, `SaldoReal`, etc.) | A serialização pode expor mais campos do que a UI precisa. | Definir contrato público enxuto/versionado quando possível. |
| Baixa | `heavy` rate-limit foi configurado, mas não há uso nos controllers | Intenção de proteger consultas pesadas não se materializa. | Aplicar policy a forecast/projeções ou remover configuração não usada. |
| Baixa | Não há versionamento explícito (`/api/v1`) | Mudanças de DTO podem afetar frontend existente. | Introduzir versionamento antes de mudanças incompatíveis. |

## Contratos/ambiguidades verificadas

- Conta local pode ser criada implicitamente pelo middleware no acesso à API; `GET /api/account/current` não é apenas leitura pura.
- `isFullyCommitted` e métricas de cobertura não fazem parte do contrato atual após a remoção do modelo de alocações.
- `frequency` em compromisso transforma o modelo em recorrente; sem frequência, `totalInstallments` é obrigatório. O backend não fornece um DTO de erro específico para a escolha inválida, apenas `message`.
- `date` de uma transação futura é aceito; `isRealized` é derivado comparando com a data de negócio, então não é um campo de entrada.
- Recebimento antecipado de recorrência registra a transação na data de confirmação, salvo quando a data agendada já passou; a ocorrência conserva `scheduledDate`.
- O backend processa automaticamente ocorrências vencidas quando certas consultas são feitas; a ordem temporal percebida pelo frontend pode mudar após uma simples atualização.

## Funcionalidades não encontradas após inspeção

Não foram encontrados endpoints de: exportação CSV/PDF, importação em lote, pesquisa/paginação de grupos, edição de ocorrência recorrente individual, cancelamento manual de ocorrência individual, webhooks, notificações, múltiplos perfis de autorização, ordenação de compromissos por query, ou CRUD de pagamentos por identificador. Estas são lacunas confirmadas apenas em relação aos componentes auditados; não são sugestões tratadas como funcionalidades existentes.

## Segurança/infraestrutura

- Autorização usa cookie e `[Authorize]`; não há papéis/claims de permissão de negócio.
- Isolamento por usuário é feito no DbContext e nas consultas dos services; a troca de conta exige vínculo no dispositivo.
- CORS permite credenciais e deve receber origens explícitas; `AllowedHosts` está `*`, mas isso não substitui CORS.
- Cookies de autenticação usam `HttpOnly`, `SameSite=Strict`, `Secure` em produção e expiração de 14 dias.
- Rate limiting retorna `429` com `Retry-After`; clientes devem respeitar o cabeçalho.
- O avatar tem limite de 5 MB e valida assinatura dos formatos aceitos.
