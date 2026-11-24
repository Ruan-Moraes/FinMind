import { describe, it, expect } from 'vitest';
import { isAuthenticApiKey } from '@/features/ai-copilot/models/model-route-resolver';
import { extractAlterTableMissingColumnStatements } from '@/shared/lib/turso-ddl';
import { computeGoalWithValueForecast } from '@/features/planning/domain/goal-forecast-projection';
import { computeCurrentNetWorthAndPace } from '@/features/planning/domain/goal-calculator';
import { snapshotRecurrenceRuleSchema } from '@/features/dashboard/domain/snapshot-entity-schemas';

describe('Audit Regression Suite (Segurança, Turso DDL, Snapshot e Cálculos)', () => {
  it('rejeita ciphertexts enc:v1: como chave de API autêntica', () => {
    expect(isAuthenticApiKey('enc:v1:aabbccddeeff:11223344:5566778899')).toBe(false);
    expect(isAuthenticApiKey('sk-proj-abc1234567890')).toBe(true);
  });

  it('gera ALTER TABLE ADD COLUMN apenas para colunas novas ausentes em tabelas Turso existentes', () => {
    const createSql = `CREATE TABLE IF NOT EXISTS "RecurrenceRule" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "description" TEXT NOT NULL,
      "dayType" TEXT NOT NULL DEFAULT 'CALENDAR_DAY',
      "skippedMonths" TEXT NOT NULL DEFAULT '[]',
      "monthlyOverrides" TEXT NOT NULL DEFAULT '{}',
      CONSTRAINT "RecurrenceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id")
    )`;

    const result = extractAlterTableMissingColumnStatements(createSql, ['id', 'description']);
    expect(result?.tableName).toBe('RecurrenceRule');
    expect(result?.alterStatements).toEqual([
      `ALTER TABLE "RecurrenceRule" ADD COLUMN "dayType" TEXT NOT NULL DEFAULT 'CALENDAR_DAY'`,
      `ALTER TABLE "RecurrenceRule" ADD COLUMN "skippedMonths" TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE "RecurrenceRule" ADD COLUMN "monthlyOverrides" TEXT NOT NULL DEFAULT '{}'`,
    ]);
  });

  it('preserva skippedMonths e monthlyOverrides no schema de snapshot de RecurrenceRule', () => {
    const parsed = snapshotRecurrenceRuleSchema.parse({
      id: 'r1',
      description: 'Aluguel',
      amountInCents: 150_000,
      skippedMonths: '["2026-11"]',
      monthlyOverrides: '{"2026-12":180000}',
    });
    expect(parsed.skippedMonths).toBe('["2026-11"]');
    expect(parsed.monthlyOverrides).toBe('{"2026-12":180000}');
  });

  it('não marca meta como alcançada em 0 meses quando um gasto previsto futuro puxa o saldo abaixo do alvo', () => {
    const res = computeGoalWithValueForecast({
      targetAmountInCents: 500_000,
      currentNetWorthInCents: 550_000,
      monthlyPaceInCents: 100_000,
      normalEstimatedMonths: 0,
      items: [
        {
          id: 'exp1',
          title: 'IPVA Futuro',
          type: 'EXPENSE',
          amountInCents: 300_000,
          expectedDate: '2026-12-15T12:00:00.000Z',
          notes: null,
        },
      ],
      referenceDate: new Date('2026-11-15T12:00:00.000Z'),
    });

    // Saldo atual (550k) - gasto futuro (300k) = 250k < 500k -> não pode dizer 0 meses!
    expect(res.projectedRemainingInCents).toBe(250_000);
    expect(res.estimatedMonthsToReach).toBe(3);
    expect(res.paceStatus).not.toBe('ACHIEVED');
  });

  it('exclui pagamentos de fatura de cartão (CREDIT_CARD_BILL_PAYMENT) do ritmo histórico para evitar dupla contagem', () => {
    const pace = computeCurrentNetWorthAndPace({
      accounts: [],
      cards: [],
      staticRules: [],
      completedTransactions: [
        { type: 'INCOME', amountInCents: 500_000, date: new Date(2026, 9, 5) },
        { type: 'EXPENSE', amountInCents: 150_000, date: new Date(2026, 9, 10) },
        {
          type: 'EXPENSE',
          amountInCents: 150_000,
          date: new Date(2026, 9, 25),
          financialAction: 'CREDIT_CARD_BILL_PAYMENT',
          purpose: 'CREDIT_CARD_BILL',
        },
      ],
      referenceDate: new Date(2026, 9, 28),
    });

    // 500k - 150k = 350k (pagamento da fatura não pode descontar 150k de novo)
    expect(pace.currentMonthlyPaceInCents).toBe(350_000);
  });
});
