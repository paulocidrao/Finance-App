# Meu Bolso — Finanças Pessoais

Aplicação full stack para controle de finanças pessoais. Permite criar uma conta, registrar receitas e despesas, organizar categorias e acompanhar o resumo financeiro do mês.

## Telas da aplicação

### Início

![Tela inicial](frontend-finance/docs/imgs/home.png)

### Transações

![Tela de transações](frontend-finance/docs/imgs/transactions.png)

### Categorias

![Tela de categorias](frontend-finance/docs/imgs/categories.png)

### Versão para celular

![Tela inicial no celular](frontend-finance/docs/imgs/home-mobile.jpeg)

![Tela de transações no celular](frontend-finance/docs/imgs/transaction-mobile.jpeg)

![Tela de categorias no celular](frontend-finance/docs/imgs/categorias-mobile.jpeg)

O projeto é dividido em dois aplicativos independentes:

- `backend-financas/` — API REST em NestJS, Prisma e PostgreSQL.
- `frontend-finance/` — SPA em Vue 3, Vite, Tailwind CSS e componentes shadcn-vue.

> Não existe um `package.json` na raiz. Cada aplicativo deve ser instalado e executado separadamente.

## Início rápido

Com Docker, Node.js e pnpm instalados, execute em dois terminais:

```bash
# Terminal 1 — banco de dados + API
cd backend-financas
docker compose up -d
pnpm install
cp .env.example .env   # apenas se o .env ainda não existir
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

```bash
# Terminal 2 — frontend
cd frontend-finance
pnpm install
pnpm dev
```

Depois acesse `http://localhost:5173` e entre com `demo@financas.local` / `senha1234`. O passo a passo detalhado está em [Como rodar o projeto](#como-rodar-o-projeto).

## Executar com ngrok e instalar a PWA no celular

Para instalar a PWA no celular, o frontend precisa ser acessado por uma URL HTTPS pública. O `localhost` do computador não pode ser aberto diretamente pelo celular.

### Configuração do frontend

No arquivo `frontend-finance/.env`, use:

```env
VITE_API_URL=/api/
VITE_API_BASE_URL=http://localhost:3000/
VITE_APP_URL=
```

O frontend chama a API por `/api/`. O proxy do Vite encaminha essas requisições para `localhost:3000`, então não é necessário criar um segundo túnel ngrok para a API.

### 1. Iniciar o banco e a API

```bash
cd backend-financas
docker compose up -d
pnpm start:dev
```

A API ficará disponível em `http://localhost:3000`.

### 2. Iniciar o frontend

Em outro terminal:

```bash
cd frontend-finance
pnpm dev
```

O service worker da PWA está habilitado no modo de desenvolvimento e o Vite aceita o domínio do ngrok.

### 3. Criar o túnel HTTPS

Em um terceiro terminal:

```bash
ngrok http 5173
```

Copie a URL `https://...ngrok...` exibida pelo ngrok e abra-a no celular.

### 4. Instalar no celular

- **Android/Chrome:** toque em **Instalar** no aviso do Meu Bolso ou abra o menu do navegador e escolha **Instalar aplicativo**.
- **iPhone/iPad:** no Safari, toque em **Compartilhar → Adicionar à Tela de Início**.

Se a opção não aparecer, reinicie o `pnpm dev`, abra novamente a URL HTTPS do ngrok e limpe os dados antigos do site/service worker. Não use `http://localhost:5173` no celular.

## Arquitetura

```text
Navegador
   │
   │  Vue 3 + Vite (http://localhost:5173)
   │  Axios com cookies (withCredentials)
   ▼
API NestJS (http://localhost:3000)
   │
   │  Prisma ORM
   ▼
PostgreSQL (localhost:5432)
```

### Autenticação

- O cadastro (`POST /auth/register`) cria o usuário com senha protegida por `bcrypt` e já gera categorias padrão.
- O login (`POST /auth/login`) valida e-mail/senha e devolve um cookie `httpOnly` chamado `access_token` com um JWT.
- A API aceita o token pelo cookie ou pelo header `Authorization: Bearer <token>`.
- Um guard global (`JwtAuthGuard`) protege as rotas. Apenas `register`, `login` e `health` são públicas.
- O frontend usa `withCredentials: true` para enviar o cookie automaticamente.

## Stack

### Backend

| Tecnologia | Uso |
| --- | --- |
| NestJS 11 | Framework da API |
| TypeScript | Linguagem |
| Prisma 6 | ORM e migrations |
| PostgreSQL 16 | Banco de dados |
| JWT + Passport | Autenticação |
| bcryptjs | Hash de senhas |
| class-validator | Validação dos DTOs |
| Swagger | Documentação em `/docs` |
| Jest | Testes unitários |

### Frontend

| Tecnologia | Uso |
| --- | --- |
| Vue 3 | Framework da interface |
| Vite 8 | Build e dev server |
| TypeScript | Linguagem |
| Vue Router | Rotas da SPA |
| Pinia | Estado global (instalado) |
| TanStack Vue Query | Cache e requisições à API |
| Axios | Cliente HTTP |
| Tailwind CSS 4 | Estilos |
| shadcn-vue / reka-ui | Componentes de interface |
| Lucide | Ícones |
| Vue Sonner | Notificações |

## Funcionalidades

- Cadastro de usuário e login.
- Dashboard com saldo, entradas, despesas e total de transações do período.
- Seleção de mês no dashboard.
- Lista das últimas transações e despesas agrupadas por categoria.
- CRUD de transações: criar, listar, consultar, editar e excluir.
- Busca por descrição, filtros por tipo e categoria, ordenação e paginação.
- CRUD de categorias, separadas entre entradas e despesas.
- Perfil do usuário autenticado.
- Saída da conta (limpeza do cache no navegador e redirecionamento para o login).
- Documentação interativa da API com Swagger.
- Coleção do Insomnia em `backend-financas/docs/insomnia-export.json`.

## Estrutura do repositório

```text
Finance-app/
├── backend-financas/
│   ├── prisma/
│   │   ├── migrations/          # Migrations versionadas
│   │   ├── schema.prisma        # Modelos User, Category e Transaction
│   │   └── seed.ts              # Dados de exemplo
│   ├── src/
│   │   ├── auth/                # Cadastro, login, JWT e guard
│   │   ├── categories/          # CRUD de categorias
│   │   ├── transactions/        # CRUD e filtros de transações
│   │   ├── summary/             # Resumo financeiro
│   │   ├── users/               # Perfil do usuário
│   │   ├── prisma/              # Serviço de conexão com o banco
│   │   ├── dtos.ts              # DTOs e validações
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── docs/                    # Coleção do Insomnia
│   ├── specs/                   # Especificações das features
│   ├── tasks/                   # Checklist de implementação
│   ├── docker-compose.yml       # PostgreSQL local
│   └── .env.example
│
└── frontend-finance/
    ├── src/
    │   ├── components/          # Componentes e UI shadcn-vue
    │   ├── layouts/             # Layouts de autenticação e dashboard
    │   ├── router/              # Rotas da SPA
    │   ├── stores/              # Store Pinia
    │   ├── utils/               # Cliente Axios e Vue Query
    │   └── views/               # Telas e serviços por feature
    ├── vite.config.ts
    └── package.json
```

## Pré-requisitos

- **Node.js 22.12 ou superior** (o projeto foi executado com Node 24).
- **pnpm 10 ou superior** — os dois projetos possuem `pnpm-lock.yaml`.
- **Docker e Docker Compose** para subir o PostgreSQL localmente.
- Portas livres: `3000` (API), `5173` (frontend) e `5432` (PostgreSQL).

Se preferir, é possível usar um PostgreSQL já instalado, desde que a `DATABASE_URL` seja ajustada.

> Os comandos abaixo usam `pnpm`, pois é o gerenciador dos lockfiles do repositório. Se preferir `npm`, troque `pnpm install` por `npm install` e `pnpm <script>` por `npm run <script>`.

## Como rodar o projeto

A ordem recomendada é: **banco → backend → frontend**.

### 1. Subir o banco de dados

```bash
cd backend-financas
docker compose up -d
docker compose ps
```

O `docker-compose.yml` cria:

- Usuário: `finance`
- Senha: `finance`
- Banco: `finance`
- Porta: `5432`

Os dados ficam no volume Docker `finance_pgdata`.

Para parar o banco:

```bash
docker compose down
```

Para apagar também os dados:

```bash
docker compose down -v
```

### 2. Configurar e rodar o backend

```bash
cd backend-financas
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

> Se o arquivo `.env` já existir, apenas confira os valores em vez de sobrescrevê-lo.

O backend ficará disponível em:

- API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- Swagger: `http://localhost:3000/docs`

Para verificar se a API e o banco estão no ar:

```bash
curl http://localhost:3000/health
```

Resposta esperada:

```json
{ "status": "ok", "database": "ok" }
```

### 3. Rodar o frontend

Em outro terminal:

```bash
cd frontend-finance
pnpm install
pnpm dev
```

Acesse `http://localhost:5173`.

O frontend chama a API em `http://localhost:3000`, configurado em `frontend-finance/src/utils/api.ts`. Se a API estiver em outro endereço, atualize esse arquivo e também a variável `FRONTEND_URL` no backend para liberar o CORS corretamente.

### 4. Entrar no sistema

Use o usuário criado pelo seed:

```text
E-mail: demo@financas.local
Senha:  senha1234
```

Também é possível criar uma conta em `http://localhost:5173/signin`.

> O seed cria transações em **outubro de 2026**. Como o dashboard abre no mês atual, selecione **outubro de 2026** no filtro de período para visualizar os dados de exemplo.

## Variáveis de ambiente do backend

Crie `backend-financas/.env` a partir de `.env.example`:

```env
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance?schema=public"
JWT_SECRET="change-me"
JWT_EXPIRES_IN="1h"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | Sim | String de conexão do PostgreSQL |
| `JWT_SECRET` | Sim | Segredo usado para assinar os tokens JWT |
| `JWT_EXPIRES_IN` | Não | Expiração do token (o cookie é configurado para 1 hora) |
| `PORT` | Não | Porta da API (padrão `3000`) |
| `FRONTEND_URL` | Não | Origem(ns) liberada(s) no CORS; aceita várias separadas por vírgula |

A aplicação não inicia se `DATABASE_URL` ou `JWT_SECRET` estiverem ausentes.

## API

Todas as rotas, exceto as marcadas como públicas, exigem autenticação por cookie `access_token` ou Bearer token.

| Método | Rota | Autenticação | Descrição |
| --- | --- | --- | --- |
| `GET` | `/health` | Pública | Verifica API e banco |
| `POST` | `/auth/register` | Pública | Cria usuário e categorias padrão |
| `POST` | `/auth/login` | Pública | Autentica e define o cookie `access_token` |
| `GET` | `/users/me` | Sim | Retorna o usuário autenticado |
| `GET` | `/categories` | Sim | Lista categorias; aceita `?type=INCOME\|EXPENSE` |
| `POST` | `/categories` | Sim | Cria categoria |
| `PATCH` | `/categories/:id` | Sim | Atualiza o nome da categoria |
| `DELETE` | `/categories/:id` | Sim | Exclui categoria sem transações vinculadas |
| `POST` | `/transactions` | Sim | Cria transação |
| `GET` | `/transactions` | Sim | Lista com filtros e paginação |
| `GET` | `/transactions/:id` | Sim | Consulta uma transação |
| `PATCH` | `/transactions/:id` | Sim | Atualiza uma transação |
| `DELETE` | `/transactions/:id` | Sim | Exclui uma transação |
| `GET` | `/summary` | Sim | Resumo do período (entradas, despesas, saldo) |
| `GET` | `/summary/by-category` | Sim | Despesas agrupadas por categoria |

### Filtros de transações

`GET /transactions` aceita:

| Parâmetro | Descrição |
| --- | --- |
| `type` | `INCOME` ou `EXPENSE` |
| `categoryId` | UUID da categoria |
| `from` / `to` | Intervalo de datas em ISO 8601 |
| `search` | Busca parcial na descrição |
| `page` | Página (padrão `1`) |
| `limit` | Itens por página (padrão `20`, máximo `100`) |
| `sort` | `date` ou `amountCents` |
| `order` | `asc` ou `desc` |

### Exemplo com `curl`

Login e uso do cookie:

```bash
curl -i -c cookies.txt \
  -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@financas.local","password":"senha1234"}'

curl -b cookies.txt http://localhost:3000/users/me
curl -b cookies.txt "http://localhost:3000/summary?from=2026-10-01&to=2026-10-31"
```

## Regras de negócio

- Valores monetários são armazenados em **centavos** (`Int`), nunca em ponto flutuante.
- Datas trafegam em ISO 8601 (UTC).
- Todo dado financeiro pertence a um usuário. Um usuário nunca acessa dados de outro; quando o recurso não pertence a ele, a API responde `404`.
- O tipo da categoria precisa ser compatível com o tipo da transação.
- Categorias com transações vinculadas não podem ser excluídas.
- Ao cadastrar um usuário, são criadas categorias padrão:
  - Entradas: `Salário`, `Outras entradas`
  - Despesas: `Alimentação`, `Moradia`, `Transporte`, `Lazer`, `Outras despesas`
- Senhas são armazenadas apenas como hash e nunca aparecem nas respostas.
- O seed é idempotente: pode ser executado mais de uma vez sem duplicar os dados de exemplo.

## Scripts

### Backend (`backend-financas`)

| Comando | O que faz |
| --- | --- |
| `pnpm start:dev` | Inicia a API em modo watch |
| `pnpm build` | Compila o projeto NestJS |
| `pnpm start` | Executa a versão compilada (`dist/main.js`) |
| `pnpm lint` | Executa o oxlint |
| `pnpm test` | Executa os testes unitários com Jest |
| `pnpm test:e2e` | Executa testes e2e (configuração ainda não incluída) |
| `pnpm prisma:generate` | Gera o Prisma Client |
| `pnpm prisma:migrate` | Aplica/cria migrations em desenvolvimento |
| `pnpm prisma:seed` | Popula o banco com o usuário demo |

### Frontend (`frontend-finance`)

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Inicia o Vite em modo desenvolvimento |
| `pnpm build` | Checagem de tipos + build de produção |
| `pnpm preview` | Pré-visualiza o build de produção |
| `pnpm lint` | Executa o oxlint |
| `pnpm test` | Executa os testes com Vitest em modo watch |
| `pnpm test:run` | Executa os testes uma vez (Vitest) |

## Documentação adicional

- Especificações das features: `backend-financas/specs/`
- Checklists de implementação: `backend-financas/tasks/`
- Regras e visão geral do backend: `backend-financas/README.md`
- Coleção do Insomnia: `backend-financas/docs/README.md`

Para importar a coleção no Insomnia: **Import/Export → Import Data → From File** e selecione `backend-financas/docs/insomnia-export.json`. O ambiente `Local` usa `http://localhost:3000` e salva automaticamente o cookie após o login.

## Observações importantes sobre o estado atual

Alguns pontos ainda precisam de ajuste e estão registrados aqui para evitar surpresas ao rodar o projeto:

- **Build do frontend:** `pnpm build` atualmente falha porque faltam as dependências `@internationalized/date` e `@unovis/vue`, usadas por componentes de calendário/gráfico, e porque a rota `/transactions/:id` referencia `src/views/transaction-detail/TransactionDetailView.vue`, que não existe. Para desenvolver, use `pnpm dev`.
- **Testes do backend:** `pnpm test` falha com `Cannot find module '#main-entry-point'` por incompatibilidade entre Jest 25 e o Prisma Client 6.19. O script `pnpm test:e2e` aponta para `test/jest-e2e.json`, que ainda não existe no repositório. O build do backend (`pnpm build`) funciona.
- **Logout:** o frontend chama `POST /auth/logout`, mas o backend ainda não expõe essa rota. A tela limpa o cache do Vue Query, tenta remover cookies acessíveis por JavaScript e redireciona para o login; porém o cookie `access_token` é `httpOnly` e não pode ser apagado pelo navegador. Na prática, a sessão continua válida até o token expirar.
- **URL da API:** está fixa em `frontend-finance/src/utils/api.ts`; não há variável de ambiente no frontend para isso.
- **Proteção de rotas no frontend:** não há guards no Vue Router. As telas podem ser abertas diretamente, mas as chamadas à API retornam `401` quando não há sessão válida.
- **Categorias no filtro de transações:** o filtro usa uma lista fixa de nomes no frontend, enquanto o formulário de nova transação busca as categorias reais na API.
