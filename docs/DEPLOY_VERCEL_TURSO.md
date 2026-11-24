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
| `AUTH_SETUP_TOKEN` | Convite de uso único. Gere com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Tipo **Secret** |
| `ADMIN_EMAIL` | Opcional. Informe apenas se precisar localizar uma conta legada com e-mail diferente de `admin@finmind.app` |
| `ADMIN_NAME` | Opcional para um banco novo. Seu nome, usado também na confirmação de reset |
| `REQUIRE_AUTH` | `true`. Na Vercel o login é obrigatório mesmo se essa variável estiver ausente |

Use o [tipo Secret da Vercel](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types) também para qualquer chave de IA que você decidir configurar. Mantenha credenciais fora do Git, de variáveis `NEXT_PUBLIC_*` e dos ambientes de Preview. Para testar previews, configure um banco separado e segredos próprios.

Antes de atualizar uma instalação existente, aplique o schema atualizado ao Turso. As tabelas `AuthOwner`, `AuthSession` e `AuthAttempt` são aditivas. Em produção, `ADMIN_PASSWORD` não é usado. O cadastro troca as credenciais da conta antiga preservando o identificador e os dados. As sessões legadas deixam de valer.

Mantenha `AUTH_SECRET` estável. Sua troca exige recadastrar chaves de IA cifradas com o valor anterior. A inscrição se encerra após o cadastro do titular e o convite pode ser removido do painel.

## 3. Verificar o primeiro deploy

1. No [Firewall da Vercel](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), configure a regra gratuita de limite por IP para `POST /`, usada pelo cadastro, login e ações do painel. Um ponto de partida é 30 requisições por minuto, com resposta 429.
2. Abra o endereço `*.vercel.app` em janela anônima. A página inicial deve pedir e-mail e senha. As rotas `/api/export?format=json`, `/api/snapshot` e `/api/ai/providers/state` devem responder 401 sem sessão.
3. Acesse **Cadastrar com convite** no domínio de produção. Informe o código, seu e-mail de acesso e uma senha de pelo menos 16 caracteres e até 72 bytes. Encerre a sessão, confirme que a opção de cadastro desapareceu e faça login com as credenciais que você escolheu. As rotas privadas devem voltar a responder 401 após o logout.
4. Para migrar dados, exporte o snapshot na instância local em **Configurações → Snapshot Completo** e importe na instância autenticada. Guarde o arquivo em local privado.

## Limites que afetam o uso

- Na Vercel Hobby, cada requisição enviada a uma Function tem limite de [4,5 MB](https://vercel.com/docs/functions/limitations#request-body-size), incluindo codificação e metadados. Divida lotes de extratos e confirme o tamanho dos snapshots antes de tentar restaurá-los. O limite se aplica também ao áudio do copiloto e ao tamanho de downloads sem streaming.
- As funções de IA externa são opcionais. Para manter custo zero e evitar enviar informações financeiras a provedores externos, deixe as chaves de IA em branco.
- Caso precise mudar de hospedagem, [Netlify Free](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/) suporta [Next.js com Server Actions](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) e oferece 300 créditos mensais com limite rígido. O build precisa ser validado separadamente.
