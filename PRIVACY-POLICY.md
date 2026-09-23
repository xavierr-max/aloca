# Política de Privacidade — base técnica editável

_Versão: 1.0 — revisar com as áreas responsáveis antes de publicar._

Este documento descreve o funcionamento técnico observado no Aloca. Ele não é parecer jurídico. Os trechos marcados como **decisão pendente** precisam ser definidos pelo responsável pelo produto, segurança e jurídico antes da publicação.

## Dados tratados

| Grupo | Dados armazenados | Onde | Finalidade técnica | Retenção técnica atual |
|---|---|---|---|---|
| Conta | `DisplayName`, `Email`, `NormalizedEmail`, `IsLocal`, datas de criação/alteração | `accounts` | Identificar a conta e permitir login protegido por e-mail | Até a exclusão da conta; e-mail normalizado é removido junto |
| Credencial derivada | `PasswordHash` produzido pelo `PasswordHasher`; `SecurityStamp` e `SessionVersion` | `accounts` | Verificar senha e invalidar sessões | Até a exclusão da conta ou troca/invalidação da credencial |
| Dispositivo | Hash SHA-256 do token do cookie, `CreatedAt`, `LastSeenAt` e vínculos com contas | `devices`, `device_accounts` | Reconhecer o navegador/dispositivo e limitar contas locais | Vínculos são removidos ao excluir a conta; dispositivos sem vínculo e sem uso por 90 dias são removidos automaticamente |
| Timestamps | `CreatedAt`, `UpdatedAt`, `LastSeenAt`, `AddedAt`, `LastUsedAt` e datas de domínio financeiro | tabelas de conta, dispositivo e domínio | Operação, auditoria funcional e cálculos financeiros | Junto do registro ao qual pertencem; a janela final é **decisão pendente** |
| Dados financeiros | Categorias, transações, saldos, compromissos, pagamentos, rendas recorrentes, ocorrências e configurações | tabelas do domínio financeiro | Funcionalidades de planejamento financeiro | Removidos na exclusão da conta |
| Sessões | Cookie de autenticação persistente, cookie de dispositivo e chaves de proteção de dados do servidor | navegador e diretório configurado em `DataProtection:KeysPath` | Manter sessão e validar cookies | Sessão: até 14 dias, com expiração deslizante; cookie do dispositivo: 90 dias; chaves: **decisão operacional pendente** |
| Backups | Cópias PostgreSQL geradas por `scripts/backup-postgres.sh` | `BACKUP_DIR` configurável, fora do volume do PostgreSQL; segunda cópia externa recomendada | Recuperação de desastre | Backup diário, 14 dias por padrão (`BACKUP_RETENTION_DAYS`); limpeza automática de dumps expirados, preservando sempre o mais recente |

## Exclusão de conta

O endpoint de exclusão remove a conta, seus vínculos de dispositivo e todos os registros financeiros relacionados. As relações também possuem cascata no banco para reduzir o risco de órfãos. Depois da exclusão, a sessão atual é invalidada e o aplicativo inicia uma nova sessão local quando aplicável.

O código não tenta reescrever nem editar cópias já existentes em backups. Uma restauração de backup pode, durante sua janela de retenção, reintroduzir dados que já foram excluídos do banco operacional. O procedimento operacional configurado é: backup diário às 02:15 UTC, retenção de 14 dias por padrão, limpeza automática apenas de arquivos diretamente em `BACKUP_DIR` cujo nome siga `aloca-postgres-YYYYMMDD-HHMMSS.dump`, remoção do checksum correspondente e preservação do dump mais recente. O diretório e os arquivos são criados com permissões restritas ao operador do serviço (`0700` para o diretório e `0600` para arquivos). O log registra somente metadados e resultado, nunca o conteúdo do dump.

## Operação de backups

- **Frequência:** diária, às 02:15 UTC pelo cron de `scripts/backup-postgres.cron.example`.
- **Retenção:** 14 dias por padrão; ajustar com `BACKUP_RETENTION_DAYS` para um inteiro positivo. O script nunca deixa a limpeza remover o último dump encontrado.
- **Armazenamento:** `BACKUP_DIR` (padrão `backups/postgres`), em armazenamento persistente separado do volume `aloca_postgres_data`. Manter uma segunda cópia em armazenamento externo, com criptografia em trânsito e em repouso quando disponível.
- **Controle de acesso:** somente o operador autorizado de backup/restore e administradores de infraestrutura; não publicar o diretório nem conceder leitura a usuários da aplicação. Os dumps podem conter e-mails, hashes de credenciais, dados de conta e informações financeiras.
- **Limpeza:** automática ao final de cada backup; somente arquivos com o padrão esperado são candidatos, com registro de sucesso/falha e do nome do arquivo expirado, sem conteúdo sensível.
- **Restore:** o script verifica o checksum quando disponível e restaura por padrão em `aloca_restore_test`; restore na produção exige `ALLOW_PRODUCTION_RESTORE=yes`. Testar periodicamente um restore em banco separado e verificar migrations e dados essenciais.

## Logs e dados sensíveis

O log de requisições registra identificador técnico da requisição, rota, método, status, duração e identificador interno da conta. Não registrar senhas, `PasswordHash`, tokens, cookies, cabeçalhos de autenticação, valores financeiros ou payloads de requisição. Novos logs devem seguir essa regra e revisões devem incluir provedores de log, APM e dumps de erro.

## Pontos que precisam de decisão antes da publicação

- identidade e contato do controlador, encarregado e canais de atendimento;
- categorias de titulares e descrição pública final dos dados tratados;
- bases legais, prazos jurídicos e eventuais obrigações de conservação;
- localização, provedores e transferências internacionais de banco, logs, backups e chaves;
- prazo definitivo dos logs e chaves de proteção de dados;
- processo operacional para atender solicitações, incidentes, restaurações e eliminação em cópias externas;
- publicação da política, data de vigência e histórico de versões.

Nenhuma base legal específica é afirmada aqui sem confirmação dessas decisões.
