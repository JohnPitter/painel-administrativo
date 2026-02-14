# Painel de Administrativo

Aplicação React em arquitetura modular monolítica com login via Firebase e painel de aplicativos, destacando os módulos de finanças pessoais e gestão de tarefas.

## Tecnologias

- React + Vite + TypeScript
- Firebase (Auth, Firestore, Analytics)
- React Router DOM
- React Hook Form + Zod
- CSS Modules com paleta inspirada nas cores do Brasil
- react-hot-toast para feedbacks instantâneos

## Estrutura

```
src/
  core/        # Configurações globais, layouts, rotas e providers
  modules/
    auth/      # Telas e lógica de autenticação
    dashboard/ # Painel principal e atalhos dos apps
    finance/   # Módulo de finanças pessoais (gastos, receitas, investimentos, cartões)
    tasks/     # Módulo de tarefas, Pomodoro e gamificação
  shared/      # Componentes e utilitários reutilizáveis
```

## Como executar

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as credenciais do backend Stripe criando o arquivo `functions/.env` a partir do `functions/.env.example` e preencha `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, etc. Esse arquivo é lido automaticamente tanto pelos emuladores quanto pelo `firebase deploy`.
3. Defina as variáveis de ambiente do front-end (ex.: `.env.local` ou `.env.development`) apontando `VITE_API_URL` para o endpoint das Cloud Functions. Durante o desenvolvimento o Vite já roteia `/api` para o endpoint publicado de produção; se quiser usar um host diferente (ex.: servidor local em `http://localhost:4242` subido com `npm run dev:server` ou o emulador em `http://localhost:5001/.../api`), basta exportar `FUNCTIONS_API_URL` antes de iniciar o `npm run dev`/`npm run dev:full`.
4. Configure o domínio autorizado do Firebase Authentication para o host local (ex.: `http://localhost:5173`).
5. (Opcional) Publique as regras do Firestore com o arquivo `firebase/firestore.rules` para restringir o acesso aos próprios dados do usuário:
   ```bash
   firebase deploy --only firestore:rules
   ```
6. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
7. Acesse `http://localhost:5173` e autentique-se com um usuário válido do projeto Firebase.

## Funcionalidades

- Tela de login com validações e feedback de erro.
- Painel administrativo com atalhos modulares para os apps.
- Módulo de finanças pessoais com abas para:
  - **Gastos:** registro por categoria e forma de pagamento.
  - **Receitas:** controle de entradas por origem.
  - **Investimentos:** acompanhamento de aplicações e rentabilidade esperada.
  - **Cartões:** registro de compras parceladas com distribuição automática das parcelas pelos meses.
- Indicadores de resumo nas cores do Brasil destacando receitas, gastos, investimentos e saldo projetado.
- Módulo de tarefas com:
  - **Visão geral:** métricas, gráfico mensal e tempo em Pomodoro por tarefa.
  - **Cadastro completo:** prioridade, descrição, status e filtros por mês/ano.
  - **Pomodoro focado:** timer personalizável com registro automático das sessões e incremento de pontos.
  - **Gamificação:** pontos, níveis, streak diário e dicas para evoluir.

## Próximos passos sugeridos

- Persistir registros financeiros no Firebase (Firestore/Realtime Database).
- Criar relatórios gráficos e filtros por período.
- Implementar controle de acesso por papéis (admins, usuários convidados).
