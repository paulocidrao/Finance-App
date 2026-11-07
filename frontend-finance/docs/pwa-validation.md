# Tarefa 7 — Offline, sessão e validação PWA

## Detecção real de conectividade

Além dos eventos online/offline, o app verifica a rede a cada 5 segundos, com timeout de 4 segundos. Isso cobre Windows com `navigator.onLine` incorretamente true após desligar Wi-Fi. Localhost continua acessível sem internet, por isso o preview consulta `https://www.gstatic.com/generate_204` sem cookies; produção consulta `/connectivity.txt` na própria origem, sem cache. O destino pode ser alterado por `VITE_CONNECTIVITY_URL`. Bloqueio desse endpoint por firewall também indica indisponibilidade: configure um destino acessível no ambiente.

Validado no Chrome com sessão demo: conexão externa bloqueada, `navigator.onLine=true`, banner visível e “Nova transação” desabilitado. Build aprovado e 18 testes de regressão aprovados. A detecção pode levar até aproximadamente 9 segundos. Reativar conexão reabilita ações após a próxima verificação. PWA instalada precisa aceitar a atualização para usar esta lógica.

## Implementação

- Banner acessível indica ausência de conexão e respostas vindas do cache.
- Criação, edição, exclusão, login e cadastro ficam desabilitados offline; os handlers e o cliente HTTP também bloqueiam mutações. Não existe fila de gravações offline.
- Workbox pré-armazena o HTML, ícones e todos os chunks, incluindo rotas lazy. `navigateFallback` usa `/index.html`: uma rota não visitada pode abrir offline após uma primeira instalação online.
- Respostas financeiras são isoladas por sessão e mantidas por até 24 horas. O fallback inclui `X-Offline-Cache: true`, nunca substitui um 401 por dados antigos e não armazena gravações.
- Em 401 autenticado, requests do Vue Query são cancelados, dados financeiros em memória/Cache Storage são removidos e o usuário vai para `/login`. Assets públicos não são apagados, para preservar o shell offline. Login incorreto permanece na tela com sua mensagem de erro.
- `POST /auth/logout` é público e retorna 204, removendo o cookie httpOnly com os mesmos atributos do login, inclusive quando o JWT expirou. Logout exige rede: em falha, não informa falsamente que o cookie foi apagado.
- Atualizações aguardam a confirmação “Atualizar”; depois da ativação a página recarrega. Workbox remove as revisões antigas. O service worker fica desativado em desenvolvimento: testar com build/preview.
- Ícones PNG 192/512, ícone Apple 180 e metadados Safari estão incluídos.

## Validação realizada em 07/11/2026

- `pnpm build`: frontend e backend aprovados.
- `pnpm preview --host 127.0.0.1 --port 4173 --strictPort`: build servido com sucesso.
- `node --test frontend-finance/scripts/test-offline.mjs backend-financas/scripts/test-auth-controller.mjs`: 17 testes aprovados (executar na raiz).
- `node scripts/test-pwa-browser.mjs`: aprovado no Chrome real. Manifest sem erros, sem bloqueios de instalação, `/transactions` abre diretamente offline, GET usa snapshot, banner visível e botões desabilitados. Executar no frontend com preview 4173; usa API simulada na porta 3000, que precisa estar livre.
- `node scripts/test-pwa-update.mjs`: aprovado no Chrome real. Nova versão fica esperando, não recarrega antes da aprovação, atualiza depois do clique, remove entrada/revisão obsoleta e cache estático antigo, e abre rota offline após atualizar. Usa servidor isolado 4180 e verifica o preview 4173.
- Lighthouse 13.6.0 foi executado com Chrome 156.0.8078.48, em headless e janela visível. A coleta falhou com `NO_FCP`; não há pontuação válida. Repetir a auditoria em um ambiente compatível/DevTools. Lighthouse recente não inclui categoria PWA: complementar com Application > Manifest/Service Workers e testes de instalação.

## Pendências obrigatórias para homologação

Não foram usados dispositivos Chrome Android nem Safari iOS. Instalação física nesses navegadores **não está confirmada**.

1. Publicar frontend e API em HTTPS. Configurar `VITE_API_URL` antes do build (não usar localhost no telefone) e `FRONTEND_URL` no backend. Preferir mesma origem/proxy para evitar restrições de cookies de terceiros no Safari.
2. Chrome Android: abrir, instalar, reabrir em standalone, visitar páginas com sessão válida, ativar modo avião, abrir `/transactions`, conferir snapshot e bloqueios, reconectar e verificar atualização dos dados.
3. Safari iOS: Compartilhar > Adicionar à Tela de Início; conferir ícone, standalone, modo avião, navegação interna e sessão. Em iOS não existe o prompt `beforeinstallprompt` do Chrome.
4. Publicar segunda versão; confirmar “Depois” mantém a versão atual e “Atualizar” instala a nova sem erros de chunks. Conferir Cache Storage para ausência de assets obsoletos.
5. Testar logout online com API real: cookie `access_token` expirado e `/users/me` retorna 401. JWT Bearer já emitido continua válido até expirar: remoção do cookie não é revogação de token no servidor.
6. Reexecutar Lighthouse e registrar relatório válido. Preview é apenas validação local, não servidor de produção.

Para recriar os ícones: `pnpm pwa:icons`. Dados em cache são snapshots locais e podem conter informações sensíveis; usar somente dispositivos confiáveis.

## Correção de logout no preview — 07/11/2026

Confirmado: a API só autorizava `http://localhost:5173`, bloqueando a origem `http://127.0.0.1:4173`. Fora de produção, CORS agora permite localhost/127.0.0.1 em 5173 e 4173. Em produção, mantém somente as origens configuradas.

Sem `VITE_API_URL`, a API local usa o mesmo hostname da página na porta 3000, evitando cookie cross-site entre localhost e 127.0.0.1. Em produção, o padrão é um proxy em `/api/` ou URL explicitamente configurada.

`node scripts/test-local-session.mjs` aprovado: teste em Chrome contra a API real, com cookie fictício httpOnly, confirmou resposta 204 acessível pelo navegador e remoção do cookie. Não usa conta real nem grava dados no banco. Exige preview 4173 e API 3000 ativos. Builds dos dois aplicativos e 17 testes de regressão aprovados novamente. A pendência de transporte/cookie do logout foi validada; dispositivos móveis e Lighthouse permanecem pendentes.