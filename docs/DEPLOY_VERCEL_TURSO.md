# Publicação gratuita do FinMind com Vercel e Turso

Use [Vercel Hobby](https://vercel.com/docs/plans/hobby) para o app Next.js de uso pessoal e não comercial e [Turso Free](https://turso.tech/pricing) para o banco libSQL. O repositório do GitHub pode ser privado e pertencer à sua conta pessoal. Use o endereço HTTPS `*.vercel.app` fornecido pelo deploy. O Turso Free inclui 5 GB de armazenamento, 500 milhões de linhas lidas e 10 milhões de linhas escritas por mês. A disponibilidade depende das cotas dos planos.

## 1. Preparar o banco

Crie um banco dedicado ao FinMind no [Turso](https://app.turso.tech). Na linha de comando, use `turso auth login`, `turso db create finmind-prod`, `turso db show finmind-prod --url` e `turso db tokens create finmind-prod`. Guarde o token em um gerenciador de senhas.

Defina `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` em um arquivo `.env` local ignorado pelo Git ou injete-os de um gerenciador de segredos. Confira o banco de destino e execute:

```sh
pnpm db:push:turso --dry-run
pnpm db:push:turso
```

O primeiro comando valida a geração do SQL. O segundo aplica o schema ao banco selecionado. Para levar dados locais ao novo banco, use o snapshot pela interface depois de verificar o login em produção.

## 2. Configurar a Vercel

1. Importe [Ruan-Moraes/FinMind](https://github.com/Ruan-Moraes/FinMind) em [vercel.com/new](https://vercel.com/new) na conta pessoal Hobby. Use a branch de produção `main` e o preset Next.js.
2. As etapas de instalação e build usam a versão do pnpm fixada em `vercel.json`. Selecione Node.js 22.x, usado também no CI.
3. Configure estas variáveis no escopo **Production** antes do primeiro deploy.

| Variável | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | URL `libsql://…` do banco de produção |
| `TURSO_AUTH_TOKEN` | Token com acesso ao banco de produção. Tipo **Secret** |
| `AUTH_SECRET` | Gere um valor exclusivo com `openssl rand -base64 32`. Tipo **Secret** |
| `ADMIN_EMAIL` | Seu e-mail de login |
| `ADMIN_PASSWORD` | Senha única gerada pelo gerenciador. Use pelo menos 16 caracteres e no máximo 72 bytes. Tipo **Secret** |
| `ADMIN_NAME` | Seu nome, usado também na confirmação de reset |
| `REQUIRE_AUTH` | `true`. Na Vercel o login é obrigatório mesmo se essa variável estiver ausente |

Use o [tipo Secret da Vercel](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types) também para qualquer chave de IA que você decidir configurar. Mantenha credenciais fora do Git, de variáveis `NEXT_PUBLIC_*` e dos ambientes de Preview. Para testar previews, configure um banco separado e segredos próprios.

O primeiro login provisiona a conta se o e-mail ainda estiver ausente no banco. A senha passa a ser validada pelo hash armazenado no banco. Alterar `ADMIN_PASSWORD` no painel depois disso **não** troca a senha da conta existente. Mantenha `AUTH_SECRET` estável. Sua troca invalida sessões e exige recadastrar chaves de IA que tenham sido cifradas com o valor anterior.

## 3. Verificar o primeiro deploy

1. No [Firewall da Vercel](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), configure a regra gratuita de limite por IP para `POST /`, usada pelo login e pelas ações do painel. Um ponto de partida é 30 requisições por minuto, com resposta 429.
2. Abra o endereço `*.vercel.app` em janela anônima. A página inicial deve pedir e-mail e senha. As rotas `/api/export?format=json`, `/api/snapshot` e `/api/ai/providers/state` devem responder 401 sem sessão.
3. Tente uma senha incorreta. Depois, entre com a conta de produção, confira o painel e encerre a sessão. Verifique que a tela de login volta e que as rotas privadas voltam a responder 401.
4. Para migrar dados, exporte o snapshot na instância local em **Configurações → Snapshot Completo** e importe na instância autenticada. Guarde o arquivo em local privado.

## Limites que afetam o uso

- Na Vercel Hobby, cada requisição enviada a uma Function tem limite de [4,5 MB](https://vercel.com/docs/functions/limitations#request-body-size), incluindo codificação e metadados. Divida lotes de extratos e confirme o tamanho dos snapshots antes de tentar restaurá-los. O limite se aplica também ao áudio do copiloto e ao tamanho de downloads sem streaming.
- As funções de IA externa são opcionais. Para manter custo zero e evitar enviar informações financeiras a provedores externos, deixe as chaves de IA em branco.
- Caso precise mudar de hospedagem, [Netlify Free](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) suporta [Next.js com Server Actions](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) e oferece 300 créditos mensais com limite rígido. O build precisa ser validado separadamente.
