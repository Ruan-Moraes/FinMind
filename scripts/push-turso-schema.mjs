#!/usr/bin/env node
/**
 * Sincroniza o schema Prisma (`prisma/schema.prisma`) com um banco remoto Turso (libSQL)
 * de forma idempotente (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN` para colunas novas
 * em tabelas existentes, e `CREATE INDEX IF NOT EXISTS`).
 *
 * Uso:
 *   pnpm db:push:turso              # aplica no TURSO_DATABASE_URL do .env / ambiente
 *   pnpm db:push:turso -- --dry-run # apenas exibe a quantidade de instruções SQL geradas
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';

function loadDotEnvIfPresent() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

function splitIdempotentSql(rawSql) {
  return rawSql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ')
        .replace(/^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
        .replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE INDEX IF NOT EXISTS ')
    );
}

function extractMissingColumnsAlterSql(createTableSql, existingCols) {
  const headerMatch = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(/i.exec(
    createTableSql.trim()
  );
  if (!headerMatch) return [];
  const tableName = headerMatch[1];
  const openIdx = createTableSql.indexOf('(');
  const closeIdx = createTableSql.lastIndexOf(')');
  if (openIdx < 0 || closeIdx <= openIdx) return [];

  const existing = new Set(existingCols.map((c) => String(c).toLowerCase()));
  const body = createTableSql.slice(openIdx + 1, closeIdx);
  const alters = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,\s*$/, '');
    if (!line || /^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(line)) continue;
    const colMatch = /^["`]?([A-Za-z0-9_]+)["`]?\s+(.+)$/.exec(line);
    if (!colMatch || existing.has(colMatch[1].toLowerCase())) continue;
    if (/\bPRIMARY\s+KEY\b/i.test(colMatch[2])) continue;
    alters.push(`ALTER TABLE "${tableName}" ADD COLUMN ${line}`);
  }
  return alters;
}

async function main() {
  loadDotEnvIfPresent();
  const dryRun = process.argv.includes('--dry-run');

  const rawSql = execSync(
    'pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
    { encoding: 'utf8' }
  );
  const statements = splitIdempotentSql(rawSql);

  if (dryRun) {
    console.log(`[Turso Sync — Dry Run] ${statements.length} instruções DDL idempotentes prontas.`);
    process.exit(0);
  }

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) {
    console.error('Erro: defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN antes de executar.');
    process.exit(1);
  }

  const client = createClient({ url, authToken: authToken || undefined });
  let addedColumns = 0;
  try {
    for (const sql of statements) {
      await client.execute(sql);
      const tableMatch = /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+["`]?([A-Za-z0-9_]+)["`]?/i.exec(sql);
      if (tableMatch) {
        const info = await client.execute(`PRAGMA table_info("${tableMatch[1]}")`);
        const existingCols = info.rows.map((r) => String(r.name ?? r[1] ?? ''));
        for (const alterSql of extractMissingColumnsAlterSql(sql, existingCols)) {
          await client.execute(alterSql);
          addedColumns += 1;
        }
      }
    }
    console.log(
      `[Turso Sync] ${statements.length} instruções DDL + ${addedColumns} coluna(s) nova(s) aplicadas em ${url}.`
    );
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('[Turso Sync] Falha ao sincronizar schema:', err);
  process.exit(1);
});
