/**
 * Converte um script DDL SQLite gerado pelo `prisma migrate diff` em uma lista
 * ordenada de comandos SQL idempotentes (`IF NOT EXISTS`) prontos para execução
 * em bancos remotos Turso / libSQL.
 */
export function prepareIdempotentLibsqlStatements(rawSql: string): string[] {
  const withoutComments = rawSql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  return withoutComments
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0)
    .map((stmt) =>
      stmt
        .replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ')
        .replace(
          /^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i,
          'CREATE UNIQUE INDEX IF NOT EXISTS '
        )
        .replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, 'CREATE INDEX IF NOT EXISTS ')
    );
}

/**
 * Extrai o nome da tabela e as definições de coluna de um `CREATE TABLE ... (...)`
 * e gera comandos `ALTER TABLE "Tabela" ADD COLUMN ...` para colunas ausentes em
 * bancos Turso/SQLite já existentes (evitando drift quando o schema evolui).
 */
export function extractAlterTableMissingColumnStatements(
  createTableSql: string,
  existingColumnNames: Iterable<string>
): { tableName: string; alterStatements: string[] } | null {
  const headerMatch = /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([A-Za-z0-9_]+)["`]?\s*\(/i.exec(
    createTableSql.trim()
  );
  if (!headerMatch) return null;

  const tableName = headerMatch[1];
  const openIdx = createTableSql.indexOf('(');
  const closeIdx = createTableSql.lastIndexOf(')');
  if (openIdx < 0 || closeIdx <= openIdx) return null;

  const existing = new Set(Array.from(existingColumnNames, (c) => c.toLowerCase()));
  const body = createTableSql.slice(openIdx + 1, closeIdx);
  const alterStatements: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/,\s*$/, '');
    if (!line) continue;
    if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(line)) continue;

    const colMatch = /^["`]?([A-Za-z0-9_]+)["`]?\s+(.+)$/.exec(line);
    if (!colMatch) continue;
    const colName = colMatch[1];
    if (existing.has(colName.toLowerCase())) continue;

    // SQLite ALTER TABLE ADD COLUMN não aceita PRIMARY KEY inline
    if (/\bPRIMARY\s+KEY\b/i.test(colMatch[2])) continue;
    alterStatements.push(`ALTER TABLE "${tableName}" ADD COLUMN ${line}`);
  }

  return { tableName, alterStatements };
}
