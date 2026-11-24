# Guia de Deploy Custo Zero — Vercel + Turso (libSQL)

Este guia descreve o passo a passo exato para publicar o **FinMind** em produção com custo **R\$ 0,00/mês**, utilizando:
- **Hospedagem Serverless:** [Vercel](https://vercel.com) (Hobby Tier gratuito)
- **Banco de Dados Relacional:** [Turso](https://turso.tech) (libSQL / SQLite Edge — Starter Tier gratuito)

---

## 1. Pré-requisitos Locais
- `pnpm` (v12+) instalado
- Repositório Git enviado para o GitHub (branch `main`)
- Conta gratuita no **Turso** e na **Vercel**

---

## 2. Criar o Banco Gratuito no Turso (libSQL)

Instale a CLI do Turso (ou crie pelo painel web em [app.turso.tech](https://app.turso.tech)):

```bash
# 1. Login no Turso
turso auth login

# 2. Criar banco gratuito (região mais próxima, ex: gru = São Paulo)
turso db create finmind-prod --location gru

# 3. Obter a URL libSQL (copie o resultado: libsql://finmind-prod-xxx.turso.io)
turso db show finmind-prod --url

# 4. Gerar token de autenticação (copie o JWT gerado)
turso db tokens create finmind-prod
```

---

## 3. Sincronizar o Schema Prisma no Turso

Como o comando `prisma db push` nativo não opera diretamente sobre URLs `libsql://`, o FinMind inclui o script idempotente `scripts/push-turso-schema.mjs` (`pnpm db:push:turso`):

```bash
# Testar geração do DDL sem alterar nada no banco remoto
pnpm db:push:turso --dry-run

# Aplicar as 19 tabelas e índices no banco remoto Turso
TURSO_DATABASE_URL="libsql://finmind-prod-xxx.turso.io" \
TURSO_AUTH_TOKEN="seu-token-turso" \
pnpm db:push:turso
```

> **Seguro para reexecutar:** todos os comandos são convertidos para `CREATE TABLE IF NOT EXISTS` e `CREATE INDEX IF NOT EXISTS`.

---

## 4. Publicar na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e importe seu repositório GitHub do **FinMind**.
2. O arquivo `vercel.json` já configura automaticamente:
   - **Framework:** Next.js
   - **Install Command:** `pnpm install --frozen-lockfile`
   - **Build Command:** `pnpm build`
3. Configure as seguintes **Environment Variables** na Vercel:

| Variável | Obrigatória | Exemplo / Como gerar |
| :--- | :---: | :--- |
| `TURSO_DATABASE_URL` | Sim | `libsql://finmind-prod-xxx.turso.io` |
| `TURSO_AUTH_TOKEN` | Sim | Token gerado via `turso db tokens create` |
| `AUTH_SECRET` | Sim | Gere com `openssl rand -base64 32` |
| `REQUIRE_AUTH` | Sim | `true` (garante tela de login obrigatória em URL pública) |
| `ADMIN_EMAIL` | Sim | Seu e-mail de acesso |
| `ADMIN_PASSWORD` | Sim | Senha forte para login em produção |
| `ADMIN_NAME` | Sim | Seu nome completo (também usado na dupla confirmação de reset) |
| `OPENAI_API_KEY` | Não | Opcional (pode configurar pela interface em *Copiloto IA*) |
| `GEMINI_API_KEY` | Não | Opcional (pode configurar pela interface em *Copiloto IA*) |
| `ANTHROPIC_API_KEY` | Não | Opcional (pode configurar pela interface em *Copiloto IA*) |

4. Clique em **Deploy**.

---

## 5. Como o Banco Troca Automaticamente (Local vs Produção)

Em [src/shared/lib/prisma.ts](../src/shared/lib/prisma.ts):
- **Desenvolvimento local / CI:** quando `TURSO_DATABASE_URL` está vazio, o Prisma usa o SQLite local (`DATABASE_URL="file:./dev.db"`).
- **Produção na Vercel:** quando `TURSO_DATABASE_URL` está preenchido, o Prisma instancia automaticamente `PrismaLibSQL({ url, authToken })` de `@prisma/adapter-libsql`.

---

## 6. Migrar seus Dados Locais para a Produção (Snapshot em 1 Clique)

Você pode levar 100% dos seus dados locais para a versão publicada na Vercel sem SQL manual:
1. No FinMind **local**, abra **Configurações → Snapshot Completo → Exportar Snapshot** (`finmind-snapshot-AAAA-MM-DD.json`).
2. Na URL publicada da **Vercel**, faça login com suas credenciais `ADMIN_*`.
3. Abra **Configurações → Snapshot Completo → Importar Snapshot**, selecione o arquivo exportado e confirme em **Confirmar e Parear Dados**.
