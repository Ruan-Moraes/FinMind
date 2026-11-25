import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL, MONTH_NAMES_PT } from '@/shared/lib/currency';
import {
  payInvoiceToolSchema,
  upsertAccountToolSchema,
  upsertCreditCardToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-extended';
import {
  brlToCents,
  resolveActiveAccount,
  resolveByName,
  resolveCreditCard,
} from '@/features/ai-agent/tools/entity-resolvers';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import {
  createAccountForUser,
  createCreditCardForUser,
  payCreditCardInvoiceForUser,
  updateAccountForUser,
} from '@/features/accounts/services/account-card-mutations';

const ACCOUNT_TYPE_LABEL = { CHECKING: 'Conta Corrente', SAVINGS: 'Reserva / Poupança', CASH: 'Dinheiro Físico' } as const;
const centsInput = (c: number) => (c / 100).toFixed(2);

/* ───────────── upsert_account ───────────── */
export const upsertAccountExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertAccountToolSchema.parse(rawArgs);
    const accounts = await prisma.account.findMany({ where: { userId, isArchived: false } });
    const existing = parsed.matchName ? resolveByName(accounts, parsed.matchName, 'conta') : null;
    if (!existing && accounts.some((a) => a.name.trim().toLowerCase() === parsed.name.trim().toLowerCase())) {
      throw new Error(`Já existe uma conta chamada "${parsed.name}". Para alterá-la, informe o nome atual.`);
    }
    const initial = parsed.initialBalanceBRL !== undefined ? brlToCents(parsed.initialBalanceBRL) : undefined;
    const finalType = (parsed.type ?? existing?.type ?? 'CHECKING') as keyof typeof ACCOUNT_TYPE_LABEL;
    return {
      title: existing ? `Editar Conta: ${existing.name}` : `Nova Conta: ${parsed.name}`,
      summary: existing
        ? `Atualizar a conta "${existing.name}" (${ACCOUNT_TYPE_LABEL[finalType] || finalType}).`
        : `Criar a conta "${parsed.name}" (${ACCOUNT_TYPE_LABEL[finalType]}) com saldo inicial de ${formatCentsToBRL(initial ?? 0)}.`,
      beforePreview: existing
        ? [{ label: 'Nome', value: existing.name }, { label: 'Tipo', value: ACCOUNT_TYPE_LABEL[existing.type as keyof typeof ACCOUNT_TYPE_LABEL] || existing.type }, { label: 'Saldo inicial', value: formatCentsToBRL(existing.initialBalanceInCents) }]
        : [{ label: 'Contas', value: 'Nova conta' }],
      afterPreview: [
        { label: 'Nome', value: parsed.name },
        { label: 'Tipo', value: ACCOUNT_TYPE_LABEL[finalType] || finalType },
        ...(initial !== undefined ? [{ label: 'Saldo inicial', value: formatCentsToBRL(initial) }] : []),
      ],
      beforeState: existing ? { action: 'UPDATE', id: existing.id, name: existing.name, type: existing.type, color: existing.color, initialBalanceInCents: existing.initialBalanceInCents } : { action: 'CREATE' },
      normalizedParams: { ...parsed, type: finalType, existingId: existing?.id ?? null },
      postConfirmVisualSteps: [
        { id: 'a1', action: 'SWITCH_TAB', tab: 'accounts', targetId: 'nav.tab.accounts', caption: 'Abrindo Contas & Cartões' },
        { id: 'a2', action: 'HIGHLIGHT', targetId: 'accounts.btn.createAccount', caption: `Conta "${parsed.name}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const parsed = upsertAccountToolSchema.parse(params);
    const existingIdRaw = typeof params.existingId === 'string' ? params.existingId : null;
    const current = existingIdRaw ? await prisma.account.findFirst({ where: { id: existingIdRaw, userId } }) : null;
    const accountType = (parsed.type ?? current?.type ?? 'CHECKING') as 'CHECKING' | 'SAVINGS' | 'CASH';
    const existingId = typeof params.existingId === 'string' ? params.existingId : null;
    const color = parsed.color || '#10b981';
    let accountId: string;
    if (existingId) {
      const res = await updateAccountForUser(userId, {
        id: existingId, name: parsed.name, type: accountType, color: parsed.color || current?.color || color,
        ...(parsed.initialBalanceBRL !== undefined ? { initialBalanceRaw: centsInput(brlToCents(parsed.initialBalanceBRL)) } : {}),
      });
      if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
      accountId = existingId;
    } else {
      const res = await createAccountForUser(userId, {
        name: parsed.name, type: accountType, color,
        initialBalanceRaw: centsInput(brlToCents(parsed.initialBalanceBRL ?? 0)),
      });
      if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
      accountId = res.account.id;
    }
    const row = await prisma.account.findFirst({ where: { id: accountId, userId } });
    const verified = Boolean(row && row.name === parsed.name && row.type === accountType);
    return { ok: verified, verified, summary: verified ? `Conta "${parsed.name}" ${existingId ? 'atualizada' : 'criada'} e verificada.` : 'Não foi possível verificar a conta.', afterState: row };
  },
  async rollback(userId, beforeState, afterState) {
    const b = beforeState as { action?: string; id?: string; name?: string; type?: string; color?: string; initialBalanceInCents?: number } | null;
    const a = afterState as { id?: string } | null;
    if (b?.action === 'UPDATE' && b.id) {
      await prisma.account.updateMany({ where: { id: b.id, userId }, data: { name: b.name, type: b.type, color: b.color, initialBalanceInCents: b.initialBalanceInCents } });
      return { ok: true, summary: `Conta "${b.name}" restaurada.` };
    }
    if (!a?.id) return { ok: false, summary: 'Conta não encontrada.' };
    const used = await prisma.transaction.count({ where: { userId, OR: [{ sourceAccountId: a.id }, { destinationAccountId: a.id }] } });
    if (used > 0) return { ok: false, summary: 'A conta já possui lançamentos; arquive-a manualmente em Contas & Cartões.' };
    await prisma.account.deleteMany({ where: { id: a.id, userId } });
    return { ok: true, summary: 'Conta recém-criada removida.' };
  },
};

/* ───────────── upsert_credit_card ───────────── */
export const upsertCreditCardExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = upsertCreditCardToolSchema.parse(rawArgs);
    const cards = await prisma.creditCard.findMany({ where: { userId } });
    const existing = parsed.matchName ? resolveByName(cards, parsed.matchName, 'cartão') : null;
    if (!existing && cards.some((c) => c.name.trim().toLowerCase() === parsed.name.trim().toLowerCase())) {
      throw new Error(`Já existe um cartão chamado "${parsed.name}". Para alterá-lo, informe o nome atual.`);
    }
    if (!existing) {
      const missing = [
        parsed.limitBRL === undefined && 'limitBRL',
        parsed.closingDay === undefined && 'closingDay',
        parsed.dueDay === undefined && 'dueDay',
      ].filter(Boolean);
      if (missing.length > 0) throw new Error(`Para criar o cartão, faltam: ${missing.join(', ')}. Para editar um cartão existente, informe matchName.`);
    }
    // Na edição, campos omitidos mantêm o valor atual (bandeira nunca volta ao padrão).
    const brand = parsed.brand ?? existing?.brand ?? 'Mastercard';
    const limit = parsed.limitBRL !== undefined ? brlToCents(parsed.limitBRL) : existing!.limitInCents;
    const closingDay = parsed.closingDay ?? existing!.closingDay;
    const dueDay = parsed.dueDay ?? existing!.dueDay;
    return {
      title: existing ? `Editar Cartão: ${existing.name}` : `Novo Cartão: ${parsed.name}`,
      summary: `${existing ? 'Atualizar' : 'Cadastrar'} cartão "${parsed.name}" (${brand}) com limite ${formatCentsToBRL(limit)}, fecha dia ${closingDay} e vence dia ${dueDay}.`,
      beforePreview: existing
        ? [{ label: 'Nome', value: existing.name }, { label: 'Bandeira', value: existing.brand }, { label: 'Limite', value: formatCentsToBRL(existing.limitInCents) }, { label: 'Fechamento/Vencimento', value: `dia ${existing.closingDay} / dia ${existing.dueDay}` }]
        : [{ label: 'Cartões', value: 'Novo cartão' }],
      afterPreview: [
        { label: 'Nome', value: parsed.name }, { label: 'Bandeira', value: brand }, { label: 'Limite', value: formatCentsToBRL(limit) },
        { label: 'Fechamento/Vencimento', value: `dia ${closingDay} / dia ${dueDay}` },
      ],
      beforeState: existing ? { action: 'UPDATE', id: existing.id, name: existing.name, brand: existing.brand, limitInCents: existing.limitInCents, closingDay: existing.closingDay, dueDay: existing.dueDay, color: existing.color } : { action: 'CREATE' },
      normalizedParams: { ...parsed, brand, limitBRL: limit / 100, closingDay, dueDay, existingId: existing?.id ?? null },
      postConfirmVisualSteps: [
        { id: 'c1', action: 'SWITCH_TAB', tab: 'accounts', targetId: 'nav.tab.accounts', caption: 'Abrindo Contas & Cartões' },
        { id: 'c2', action: 'HIGHLIGHT', targetId: 'accounts.btn.createCard', caption: `Cartão "${parsed.name}"`, pauseMs: 400 },
      ],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const parsed = upsertCreditCardToolSchema.parse(params);
    const existingId = typeof params.existingId === 'string' ? params.existingId : null;
    const current = existingId ? await prisma.creditCard.findFirst({ where: { id: existingId, userId } }) : null;
    if (existingId && !current) return { ok: false, verified: false, summary: 'Cartão não encontrado.', error: 'Cartão não encontrado.' };
    const brand = parsed.brand ?? current?.brand ?? 'Mastercard';
    const limit = parsed.limitBRL !== undefined ? brlToCents(parsed.limitBRL) : current?.limitInCents;
    const closingDay = parsed.closingDay ?? current?.closingDay;
    const dueDay = parsed.dueDay ?? current?.dueDay;
    if (limit === undefined || limit <= 0 || closingDay === undefined || dueDay === undefined) {
      return { ok: false, verified: false, summary: 'Limite e dias de fechamento/vencimento são obrigatórios.', error: 'Parâmetros incompletos.' };
    }
    let cardId: string;
    if (existingId) {
      const res = await prisma.creditCard.updateMany({
        where: { id: existingId, userId },
        data: { name: parsed.name, brand, limitInCents: limit, closingDay, dueDay, ...(parsed.color ? { color: parsed.color } : {}) },
      });
      if (res.count === 0) return { ok: false, verified: false, summary: 'Cartão não encontrado.', error: 'Cartão não encontrado.' };
      cardId = existingId;
    } else {
      const res = await createCreditCardForUser(userId, {
        name: parsed.name, brand, limitRaw: centsInput(limit),
        closingDay, dueDay, color: parsed.color || '#6366f1',
      });
      if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
      cardId = res.card.id;
    }
    const row = await prisma.creditCard.findFirst({ where: { id: cardId, userId } });
    const verified = Boolean(row && row.limitInCents === limit && row.closingDay === closingDay && row.dueDay === dueDay && row.brand === brand);
    return { ok: verified, verified, summary: verified ? `Cartão "${parsed.name}" ${existingId ? 'atualizado' : 'criado'} e verificado.` : 'Não foi possível verificar o cartão.', afterState: row };
  },
  async rollback(userId, beforeState, afterState) {
    const b = beforeState as { action?: string; id?: string; name?: string; brand?: string; limitInCents?: number; closingDay?: number; dueDay?: number; color?: string } | null;
    const a = afterState as { id?: string } | null;
    if (b?.action === 'UPDATE' && b.id) {
      await prisma.creditCard.updateMany({ where: { id: b.id, userId }, data: { name: b.name, brand: b.brand, limitInCents: b.limitInCents, closingDay: b.closingDay, dueDay: b.dueDay, color: b.color } });
      return { ok: true, summary: `Cartão "${b.name}" restaurado.` };
    }
    if (!a?.id) return { ok: false, summary: 'Cartão não encontrado.' };
    const used = await prisma.transaction.count({ where: { userId, creditCardId: a.id } });
    if (used > 0) return { ok: false, summary: 'O cartão já possui lançamentos; exclua-o manualmente em Contas & Cartões.' };
    await prisma.creditCard.deleteMany({ where: { id: a.id, userId } });
    return { ok: true, summary: 'Cartão recém-criado removido.' };
  },
};

/* ───────────── pay_credit_card_invoice ───────────── */
export const payCreditCardInvoiceExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = payInvoiceToolSchema.parse(rawArgs);
    const card = await resolveCreditCard(userId, parsed.cardName);
    const account = await resolveActiveAccount(userId, parsed.accountName);
    const invoice = await prisma.creditCardInvoice.findUnique({
      where: { creditCardId_month_year: { creditCardId: card.id, month: parsed.month, year: parsed.year } },
      include: { transactions: true },
    });
    const label = `${MONTH_NAMES_PT[parsed.month - 1]}/${parsed.year}`;
    if (!invoice) throw new Error(`Não há fatura de ${card.name} em ${label}.`);
    if (invoice.status === 'PAID') throw new Error(`A fatura de ${card.name} em ${label} já está paga.`);
    const total = invoice.transactions.reduce((s, t) => s + t.amountInCents, 0);
    if (total <= 0) throw new Error(`A fatura de ${card.name} em ${label} está zerada.`);
    return {
      title: `Pagar Fatura: ${card.name} (${label})`,
      summary: `Pagar ${formatCentsToBRL(total)} da fatura de ${card.name} (${label}) com a conta "${account.name}".`,
      beforePreview: [{ label: 'Fatura', value: `${formatCentsToBRL(total)} • ${invoice.status === 'CLOSED' ? 'Fechada' : 'Aberta'}` }, { label: 'Saldo da conta', value: 'Será debitado do saldo atual' }],
      afterPreview: [{ label: 'Fatura', value: 'Paga' }, { label: 'Débito', value: `${formatCentsToBRL(total)} em ${account.name}` }],
      beforeState: { invoiceId: invoice.id, status: invoice.status, paidAmountInCents: invoice.paidAmountInCents },
      normalizedParams: { cardId: card.id, accountId: account.id, month: parsed.month, year: parsed.year, expectedInCents: total },
      postConfirmVisualSteps: [{ id: 'p1', action: 'SWITCH_TAB', tab: 'accounts', targetId: 'nav.tab.accounts', caption: 'Abrindo Contas & Cartões' }],
      reversible: true,
    };
  },
  async executeAndVerify(userId, params) {
    const month = Number(params.month);
    const year = Number(params.year);
    const cardId = String(params.cardId || '');
    const res = await payCreditCardInvoiceForUser(userId, { creditCardId: cardId, month, year, sourceAccountId: String(params.accountId || '') });
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
    const invoice = await prisma.creditCardInvoice.findUnique({ where: { creditCardId_month_year: { creditCardId: cardId, month, year } } });
    const payment = await prisma.transaction.findFirst({
      where: { userId, financialAction: 'CREDIT_CARD_BILL_PAYMENT', sourceAccountId: String(params.accountId), amountInCents: res.paidAmountInCents },
      orderBy: { createdAt: 'desc' },
    });
    const verified = invoice?.status === 'PAID' && Boolean(payment);
    return { ok: verified, verified, summary: verified ? `Fatura paga (${formatCentsToBRL(res.paidAmountInCents)}) e verificada.` : 'Não foi possível verificar o pagamento.', afterState: { invoiceId: invoice?.id, paymentTransactionId: payment?.id } };
  },
  async rollback(userId, beforeState, afterState) {
    const b = beforeState as { invoiceId?: string; status?: string; paidAmountInCents?: number } | null;
    const a = afterState as { paymentTransactionId?: string } | null;
    if (!b?.invoiceId) return { ok: false, summary: 'Estado anterior da fatura indisponível.' };
    await prisma.$transaction([
      prisma.creditCardInvoice.update({ where: { id: b.invoiceId }, data: { status: b.status || 'OPEN', paidAmountInCents: b.paidAmountInCents ?? 0, paidAt: null } }),
      ...(a?.paymentTransactionId ? [prisma.transaction.deleteMany({ where: { id: a.paymentTransactionId, userId } })] : []),
    ]);
    return { ok: true, summary: 'Pagamento desfeito: fatura reaberta e débito removido.' };
  },
};
