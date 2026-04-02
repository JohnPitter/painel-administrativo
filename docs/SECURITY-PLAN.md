# Plano de Fortalecimento de Segurança e Backend Unificado

Este documento descreve a migração de todos os módulos para uma camada de API centralizada (Cloud Functions), com validação de assinatura no backend e bloqueio de acessos diretos ao Firestore/Storage. O objetivo é manter a aplicação funcional (incluindo modos local/offline), porém com garantias de que usuários com assinatura suspensa não consigam sincronizar dados sensíveis.

---

## Progresso Atual

- **Finanças**: concluído. Todas as operações (gastos, receitas, investimentos, planner e categorias) já usam o Cloud Functions API com cache remoto, fallback visitante e sincronização em segundo plano.
- **Tarefas & Pomodoro**: migrado. Router `/api/tasks` cobre CRUD, status, pomodoros e gamificação; o contexto utiliza cache/local fallback.
- **Notas** e **Calendário**: migrados. Ambos possuem serviços HTTP e routers dedicados (`/api/notes`, `/api/calendar`) com carregamento via cache remoto e modo visitante.
- **Relacionamentos**: concluído. O serviço `/api/relationships` cobre contatos/interações e o contexto já usa cache remoto persistido, fallback visitante e sincronização pós-escrita.
- **Automações**: concluído. O módulo consome `/api/automations` com normalização/validação dos dados retornados (garantindo defaults seguros) e mantém cache remoto + fallback local igual aos demais.
- **Controle de tempo (Timeclock)**: concluído. O módulo usa `/api/timeclock`, com validação de jornada no backend, cache remoto persistido e fallback local para visitantes ou assinaturas suspensas.
- **Perfil da conta e assinatura**: concluído. `AccountContext` agora consome `/api/account` (perfil, avatar e cancelamento) e o fluxo de renovação usa `/api/billing/renew` para validar o pagamento no backend antes de atualizar o Firestore.

---

## Módulos cobertos

1. **Finanças** (gastos, receitas, investimentos, planner)
2. **Tarefas & Pomodoro**
3. **Notas**
4. **Calendário**
5. **Relacionamentos**
6. **Automações**
7. **Controle de tempo (Timeclock)**

Cada módulo seguirá a mesma estrutura de API, validação e fallback local.

---

## Etapa 1 — API (Cloud Functions)

### 1.1 Estrutura geral

- Criar uma aplicação Express dentro da função `api` com rotas específicas por módulo:
  - `POST /finance/expenses`, `GET /finance/expenses`, etc.
  - `POST /tasks`, `PATCH /tasks/:id`, etc.
  - Repetir para notas, calendário, relacionamentos, automações e timeclock.
- Middleware de autenticação:
  - Recuperar `context.auth.uid` (via `authenticateRequest`).
  - Buscar perfil `users/{uid}` e validar `subscriptionStatus` + `activeUntil`.
  - Se assinatura suspensa → retornar `403` com mensagem padronizada.

### 1.2 Regras por módulo

| Módulo          | Operações mínimas                                                      |
|-----------------|------------------------------------------------------------------------|
| Finanças        | Gastos, receitas, investimentos, planner (alocações/metas)             |
| Tarefas         | CRUD de tarefas, pomodoros, gamificação                                |
| Notas           | CRUD + ordenação/pinned                                                |
| Calendário      | CRUD de eventos + reminders                                            |
| Relacionamentos | Contatos, interações, estágios/prioridades                             |
| Automações      | CRUD de regras automáticas (simulação/manual toggle)                  |
| Timeclock       | CRUD de entradas, exportação PDF                                       |

### 1.3 Considerações adicionais

- **Recorrências e cálculos**: mover a lógica para o backend (ou reaproveitar funções utilitárias).
- **Filtros**: endpoints devem aceitar parâmetros de período (ano/mês) e paginação.
- **Respostas**: retornar objetos prontos para consumo no front (incluindo IDs e metadados).

---

## Etapa 2 — Regras do Firestore e Storage

### 2.1 Firestore

- Atualizar `firebase/firestore.rules` para negar qualquer operação direta dos clientes nas coleções:
  - `users/{uid}/expenses`, `users/{uid}/tasks`, etc.
- Permitir apenas operações via Cloud Functions:
  - Usar [App Check para Functions](https://firebase.google.com/docs/app-check/cloud-functions) ou checar `request.auth.token.firebase.sign_in_provider == "custom"` se necessário.
  - Alternativa: mover dados para `service accounts` exclusivos via Admin SDK e bloquear totalmente o acesso de clientes.

### 2.2 Storage

- Regras para impedir upload/download direto de arquivos (ex.: avatares) quando a assinatura estiver suspensa.
- Recomendar mover uploads (ex.: foto de perfil) para uma função HTTP, onde podemos repetir a validação de assinatura antes de gravar no bucket.

---

## Etapa 3 — Refatoração dos Contextos/Serviços no Front

### 3.1 Serviço HTTP por módulo

- Criar `financeService.ts`, `tasksService.ts`, etc., encapsulando `fetch`/`axios` com:
  - Header Authorization com `await user.getIdToken()`.
  - Tratamento de erros (403 → cair para modo local).

### 3.2 Contextos React

- Remover `onSnapshot` e `addDoc` diretos.
- Em cada provider (`FinanceContext`, `TaskContext`, etc.):
  - No `useEffect` inicial, chamar `GET` da API para carregar dados.
  - Nas operações (`addExpense`, `updateTask`, etc.), chamar a API e sincronizar o estado local com a resposta.
  - Se a API retornar 403, disparar fallback local (identical ao modo visitante).

### 3.3 Modo local/offline

- `useLocalMode` decidirá quando operar em localStorage (caso assinatura tenha expirado).
- O comportamento atual de persistir em localStorage continua válido; apenas garantimos que nenhum write remoto é tentado quando suspenso.

---

## Etapa 4 — Testes e Deploy

1. Testar cada módulo com o emulador (Auth + Functions + Firestore).
2. Casos principais:
   - Usuário ativo: CRUD funcional, recorrências, filtros.
   - Usuário suspenso: API responde 403 e o front permanece em modo local (sem erros).
   - Visitante: fluxo local (sem chamar a API).
3. Deploy incremental:
   - Primeiro, publicar as funções (`firebase deploy --only functions:api`).
   - Depois, publicar o front (`firebase deploy --only hosting`).

---

## Sequenciamento sugerido

1. Finanças (maior demanda, inclui planner).
2. Tarefas/Pomodoro (recorrência e gamificação).
3. Notas (mais simples, bom para consolidar padrão).
4. Calendário e Relacionamentos (estruturas moderadas).
5. Automações e Timeclock (envolvem ações adicionais como simular/gerar PDF).
6. Por fim, uploads/Storage (avatar) via função.

Cada módulo só deve ser migrado após o anterior estar estável para evitar regressões no app.

---

## Observações Finais

- As regras do Firestore/Storage precisam ser atualizadas no mesmo deploy que a API, para evitar janelas onde o cliente ainda tenha acesso direto.
- Recomenda-se adicionar testes automatizados (unitários ou Postman/Newman) para os novos endpoints.
- Documentar os contratos (payloads/respostas) para facilitar a manutenção futura e eventual adoção de App Check/UI offline.

---

## Pendências Abertas

No momento, não há módulos restantes acessando Firestore/Storage diretamente a partir do front. Próximas evoluções desejáveis:

1. Endurecer regras do Firestore/Storage para bloquear qualquer acesso direto de clientes (apenas Cloud Functions).
2. Automatizar testes dos endpoints (ex.: collection de requests no Postman/Newman) para evitar regressões futuras.
