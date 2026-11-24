import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { isPublicAuthRequired, requireAuthenticatedUser } from '@/features/auth';
import {
  escapeCsvCell,
  buildTransactionsCsv,
  buildUserTransactionsCsv,
  buildUserFinancialBackup,
} from '@/features/transactions/services/export-service';
import { GET as exportRouteGet } from '@/app/api/export/route';

const TEST_EMAIL = 'test.export.vitest@finmind.local';
let testUserId = '';

describe('Integração SQLite: Política de Acesso Público & Exportação CSV/JSON', () => {
  beforeAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
    }
    const created = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Usuário Exportação Teste',
        passwordHash: 'super-secret-bcrypt-hash',
        settings: {
          create: {
            theme: 'DARK',
            density: 'COMFORTABLE',
            fiscalMonthStartDay: 1,
            openaiApiKey: 'sk-secret-openai-key-must-never-leak',
            geminiApiKey: 'AIza-secret-gemini-key',
            claudeApiKey: 'sk-ant-secret-claude-key',
          },
        },
        accounts: {
          create: { name: 'Conta Export', type: 'CHECKING', initialBalanceInCents: 150000 },
        },
        categories: {
          create: { name: 'Alimentação Export', type: 'EXPENSE' },
        },
      },
      include: { accounts: true, categories: true },
    });
    testUserId = created.id;

    await prisma.transaction.create({
      data: {
        userId: testUserId,
        sourceAccountId: created.accounts[0].id,
        categoryId: created.categories[0].id,
        description: 'Supermercado; "Central"',
        amountInCents: 24590,
        type: 'EXPENSE',
        nature: 'VARIABLE',
        date: new Date(Date.UTC(2026, 10, 15, 12, 0, 0)),
        status: 'COMPLETED',
        tags: '#mercado,#casa',
      },
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
  });

  it('isPublicAuthRequired aplica proteção automática na Vercel ou com REQUIRE_AUTH=true', () => {
    expect(isPublicAuthRequired({})).toBe(false);
    expect(isPublicAuthRequired({ VERCEL: '1' })).toBe(true);
    expect(isPublicAuthRequired({ REQUIRE_AUTH: 'true' })).toBe(true);
    expect(isPublicAuthRequired({ VERCEL: '1', REQUIRE_AUTH: 'false' })).toBe(false);
  });

  it('requireAuthenticatedUser e /api/export bloqueiam acesso sem sessão quando REQUIRE_AUTH=true', async () => {
    const prev = process.env.REQUIRE_AUTH;
    process.env.REQUIRE_AUTH = 'true';
    try {
      await expect(requireAuthenticatedUser()).rejects.toThrow(/Autenticação obrigatória/i);
      const req = new NextRequest('http://localhost:3123/api/export?format=json');
      const res = await exportRouteGet(req);
      expect(res.status).toBe(401);
    } finally {
      if (prev === undefined) delete process.env.REQUIRE_AUTH;
      else process.env.REQUIRE_AUTH = prev;
    }
  });

  it('escapeCsvCell e buildTransactionsCsv protegem contra Formula Injection e geram UTF-8 BOM', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('a;b "c"')).toBe('"a;b ""c"""');

    const csv = buildTransactionsCsv([
      {
        date: new Date(Date.UTC(2026, 10, 15, 12, 0, 0)),
        description: '=CMD|calc',
        type: 'EXPENSE',
        nature: 'VARIABLE',
        categoryName: 'Outros',
        accountName: 'Nubank',
        creditCardName: null,
        amountInCents: 12345,
        status: 'COMPLETED',
        installmentNumber: 1,
        totalInstallments: 3,
        tags: '#teste',
      },
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain("'=CMD|calc");
    expect(csv).toContain('-123,45');
    expect(csv).toContain('1/3');
  });

  it('buildUserTransactionsCsv e buildUserFinancialBackup exportam dados completos sem vazar segredos', async () => {
    const { csv, filename, count } = await buildUserTransactionsCsv(testUserId, {
      month: 11,
      year: 2026,
    });
    expect(count).toBe(1);
    expect(filename).toBe('finmind-extrato-2026-11.csv');
    expect(csv).toContain('"Supermercado; ""Central"""');
    expect(csv).toContain('-245,90');

    const backup = await buildUserFinancialBackup(testUserId);
    const serialized = JSON.stringify(backup.payload);
    expect(backup.filename).toMatch(/^finmind-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(backup.payload.schemaVersion).toBe('1.0');
    expect(backup.payload.summary.accounts).toBe(1);
    expect(backup.payload.summary.transactions).toBe(1);
    expect(serialized).not.toContain('super-secret-bcrypt-hash');
    expect(serialized).not.toContain('sk-secret-openai-key');
    expect(serialized).not.toContain('AIza-secret-gemini-key');
    expect(serialized).not.toContain('sk-ant-secret-claude-key');
  });

  it('GET /api/export retorna CSV (200), JSON (200) e rejeita formato inválido (400)', async () => {
    const csvRes = await exportRouteGet(
      new NextRequest('http://localhost:3123/api/export?format=csv&month=11&year=2026')
    );
    expect(csvRes.status).toBe(200);
    expect(csvRes.headers.get('content-type')).toContain('text/csv');
    expect(csvRes.headers.get('content-disposition')).toContain('finmind-extrato-2026-11.csv');

    const jsonRes = await exportRouteGet(
      new NextRequest('http://localhost:3123/api/export?format=json')
    );
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get('content-type')).toContain('application/json');

    const badRes = await exportRouteGet(
      new NextRequest('http://localhost:3123/api/export?format=xml')
    );
    expect(badRes.status).toBe(400);
  });
});
