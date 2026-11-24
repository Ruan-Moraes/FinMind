import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as handleGetModels } from '@/app/api/ai/models/route';
import { prepareIdempotentLibsqlStatements } from '@/shared/lib/turso-ddl';

describe('Integração: /api/ai/models multi-provedor & Preparação DDL Turso libSQL', () => {
  it('responde de forma estruturada e sem fallback estático para OPENAI, GEMINI e CLAUDE via GET /api/ai/models', async () => {
    for (const provider of ['OPENAI', 'GEMINI', 'CLAUDE'] as const) {
      const req = new NextRequest(`http://localhost:3000/api/ai/models?provider=${provider}`);
      const res = await handleGetModels(req);
      const body = (await res.json()) as {
        ok: boolean;
        provider: string;
        models: Array<{ id: string; displayName: string }>;
        diagnosticCode?: string | null;
      };
      expect(body.provider).toBe(provider);
      expect(Array.isArray(body.models)).toBe(true);
      if (body.ok) {
        expect(res.status).toBe(200);
        expect(body.models.length).toBeGreaterThan(0);
      } else {
        expect(body.models).toEqual([]);
        expect(body.diagnosticCode).toBeTruthy();
      }
    }
  });

  it('converte DDL SQLite do Prisma em instruções idempotentes para Turso libSQL', () => {
    const raw = `
      -- CreateTable
      CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
      -- CreateIndex
      CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
      CREATE INDEX "Tx_user_idx" ON "Transaction"("userId");
    `;

    const stmts = prepareIdempotentLibsqlStatements(raw);
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toMatch(/^CREATE TABLE IF NOT EXISTS "User"/);
    expect(stmts[1]).toMatch(/^CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"/);
    expect(stmts[2]).toMatch(/^CREATE INDEX IF NOT EXISTS "Tx_user_idx"/);
  });
});
