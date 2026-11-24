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
