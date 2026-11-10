# Meu Bolso — Frontend

Aplicação de finanças pessoais feita com Vue 3, TypeScript, Vite, Pinia e Vue Query. O frontend possui suporte a PWA e funcionamento offline para leitura dos dados já armazenados.

## Pré-requisitos

- Node.js 22 ou superior
- pnpm 10 ou superior

Para instalar as dependências localmente:

```bash
corepack enable
pnpm install
```

## Variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

- `VITE_API_URL`: URL da API. O valor recomendado é `/api/`, que usa o proxy local e também funciona pelo domínio HTTPS do ngrok.
- `VITE_API_BASE_URL`: origem da API local usada pelo proxy e pelo service worker, normalmente `http://localhost:3000/`.
- `VITE_APP_URL`: opcional; deixe vazio para manter o domínio atual, inclusive quando acessado pelo ngrok.
- `VITE_CONNECTIVITY_URL`: endpoint opcional usado para verificar conectividade.

## Executar localmente

Inicie a API na porta `3000` e, em outro terminal, execute:

```bash
pnpm dev
```

Acesse [http://localhost:5173](http://localhost:5173).

Para gerar e servir uma versão de produção:

```bash
pnpm build
pnpm preview
```

## Executar com Docker

O Docker Compose inicia o frontend em modo desenvolvimento, com hot reload:

```bash
docker compose up --build frontend
```

Acesse [http://localhost:5173](http://localhost:5173). A API continua sendo executada fora do container, normalmente em `http://localhost:3000`.

Para criar e servir a imagem de produção com Nginx:

```bash
docker compose --profile production up --build frontend-production
```

Acesse [http://localhost:8080](http://localhost:8080). Se a API estiver em outra URL, informe-a durante o build:

```bash
VITE_API_URL=https://api.exemplo.com/ \
  docker compose --profile production up --build frontend-production
```

## Testes e qualidade

```bash
pnpm test:unit
pnpm test:offline
pnpm test
pnpm lint
pnpm build
```

Os testes de PWA exigem Chromium e um servidor de preview já iniciado:

```bash
pnpm build
pnpm preview --host 0.0.0.0
pnpm test:pwa
pnpm test:pwa:update
```

## Estrutura principal

- `src/views`: telas de login, cadastro, início, transações, categorias e perfil.
- `src/components`: componentes reutilizáveis e diálogos de transação.
- `src/services` e `src/utils`: integração com API, sessão, conectividade e cache offline.
- `src/sw.js`: service worker e estratégias de cache da PWA.
- `scripts`: verificações automatizadas de PWA, sessão e funcionamento offline.
