import { prisma } from '@/shared/lib/prisma';
import { formatCentsToBRL } from '@/shared/lib/currency';
import { createTransactionToolSchema } from '@/features/ai-agent/tools/tool-catalog';
import {
  deleteTransactionToolSchema,
  updateTransactionToolSchema,
} from '@/features/ai-agent/tools/tool-catalog-extended';
import {
  brlToCents,
  resolveActiveAccount,
  resolveCategory,
  resolveCreditCard,
} from '@/features/ai-agent/tools/entity-resolvers';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';
import { createTransactionForUser } from '@/features/transactions/services/transaction-mutations';
import {
  deleteTransactionForUser,
  updateTransactionForUser,
} from '@/features/transactions/services/transaction-manage-mutations';

const TYPE_LABEL = { INCOME: 'Receita', EXPENSE: 'Despesa', TRANSFER: 'Transferência' } as const;
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const centsToInput = (c: number) => (c / 100).toFixed(2);

/* ───────────── create_transaction ───────────── */
export const createTransactionExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = createTransactionToolSchema.parse(rawArgs);
    const cents = brlToCents(parsed.amountBRL);

    if (parsed.cardName && parsed.type !== 'EXPENSE') {
      throw new Error('Cartão de crédito só pode ser usado em despesas.');
    }
    const card = parsed.cardName ? await resolveCreditCard(userId, parsed.cardName) : null;
    const account = card ? null : await resolveActiveAccount(userId, parsed.accountName);

    let destination = null as Awaited<ReturnType<typeof resolveActiveAccount>> | null;
    if (parsed.type === 'TRANSFER') {
      if (!parsed.destinationAccountName) throw new Error('Informe a conta de destino da transferência.');
      destination = await resolveActiveAccount(userId, parsed.destinationAccountName);
      if (destination.id === account?.id) throw new Error('A conta de origem e a de destino devem ser diferentes.');
    }

    const category =
      parsed.categoryName && parsed.type !== 'TRANSFER'
        ? await resolveCategory(userId, parsed.categoryName, parsed.type as 'INCOME' | 'EXPENSE')
        : null;
    const installments = card ? parsed.installments : 1;
    const typeLabel = TYPE_LABEL[parsed.type];

    const after = [
      { label: 'Descrição', value: parsed.description },
      { label: 'Valor', value: installments > 1 ? `${formatCentsToBRL(cents)} em ${installments}x` : formatCentsToBRL(cents) },
      { label: 'Data', value: parsed.date },
      { label: card ? 'Cartão' : 'Conta', value: card?.name || account!.name },
      ...(destination ? [{ label: 'Conta destino', value: destination.name }] : []),
      ...(parsed.type !== 'TRANSFER'
        ? [{ label: 'Categoria', value: category?.name || 'Automática pelas regras aprendidas (ou sem categoria)' }]
        : []),
      { label: 'Status', value: card ? 'Concluído (fatura)' : parsed.status === 'PENDING' ? 'Pendente' : 'Concluído' },
    ];

    return {
      title: `Novo Lançamento (${typeLabel})`,
      summary: `Registrar ${typeLabel.toLowerCase()} "${parsed.description}" de ${formatCentsToBRL(cents)} em ${parsed.date}${card ? ` no cartão ${card.name}` : ''}.`,
      beforePreview: [{ label: 'Extrato', value: 'Novo registro a incluir' }],
      afterPreview: after,
      beforeState: { action: 'CREATE' },
      normalizedParams: {
        ...parsed,
        resolvedAccountId: account?.id ?? null,
        resolvedDestinationAccountId: destination?.id ?? null,
        resolvedCardId: card?.id ?? null,
        resolvedCategoryId: category?.id ?? null,
      },
      postConfirmVisualSteps: [
        { id: 's1', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Navegando para Extrato & Comprovantes' },
        { id: 's2', action: 'HIGHLIGHT', targetId: 'transactions.table', caption: `Registrando "${parsed.description}"`, pauseMs: 320 },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = createTransactionToolSchema.parse(params);
    const str = (k: string) => (typeof params[k] === 'string' && params[k] ? (params[k] as string) : undefined);
    const accountId = str('resolvedAccountId');
    const destinationId = str('resolvedDestinationAccountId');
    const cardId = str('resolvedCardId');
    const categoryId = str('resolvedCategoryId');

    // Revalida a posse dos IDs resolvidos (o preview pode ter sido gerado antes de qualquer mudança).
    const [ownedAccount, ownedDest, ownedCard, ownedCat] = await Promise.all([
      accountId ? prisma.account.findFirst({ where: { id: accountId, userId, isArchived: false } }) : null,
      destinationId ? prisma.account.findFirst({ where: { id: destinationId, userId, isArchived: false } }) : null,
      cardId ? prisma.creditCard.findFirst({ where: { id: cardId, userId } }) : null,
      categoryId ? prisma.category.findFirst({ where: { id: categoryId, userId } }) : null,
    ]);
    if ((accountId && !ownedAccount) || (destinationId && !ownedDest) || (cardId && !ownedCard) || (categoryId && !ownedCat)) {
      return { ok: false, verified: false, summary: 'Conta, cartão ou categoria não encontrados. Refaça o pedido.', error: 'Entidade inválida.' };
    }

    const res = await createTransactionForUser(userId, {
      type: parsed.type,
      nature: parsed.nature,
      amountRaw: centsToInput(brlToCents(parsed.amountBRL)),
      date: parsed.date,
      description: parsed.description,
      status: parsed.status,
      paymentTarget: ownedCard ? 'CREDIT_CARD' : 'ACCOUNT',
      sourceAccountId: ownedAccount?.id,
      destinationAccountId: ownedDest?.id,
      creditCardId: ownedCard?.id,
      categoryId: ownedCat?.id,
      installments: ownedCard ? parsed.installments : undefined,
      tags: parsed.tags,
    });
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };

    const rows = await prisma.transaction.findMany({ where: { id: { in: res.createdIds }, userId } });
    const total = rows.reduce((s, r) => s + r.amountInCents, 0);
    const expected = brlToCents(parsed.amountBRL);
    // Parcelas redistribuem centavos: tolera diferença de até 1 centavo por parcela.
    const verified = rows.length === res.createdIds.length && rows.length > 0 && Math.abs(total - expected) <= rows.length;

    return {
      ok: verified,
      verified,
      summary: verified
        ? `Lançamento "${parsed.description}" (${formatCentsToBRL(expected)}${rows.length > 1 ? ` em ${rows.length}x` : ''}) salvo e confirmado.`
        : 'Não foi possível confirmar o lançamento no banco.',
      afterState: { ids: res.createdIds, installmentGroupId: res.installmentGroupId },
      verificationDetail: { createdCount: rows.length, totalInCents: total },
    };
  },

  async rollback(userId, _before, afterState) {
    const after = afterState as { ids?: string[]; installmentGroupId?: string | null } | null;
    if (!after?.ids?.length) return { ok: false, summary: 'Lançamento não encontrado para reversão.' };
    await prisma.transaction.deleteMany({ where: { id: { in: after.ids }, userId } });
    if (after.installmentGroupId) await prisma.installmentGroup.deleteMany({ where: { id: after.installmentGroupId, userId } });
    return { ok: true, summary: 'Lançamento recém-criado removido (ação desfeita).' };
  },
};

/* ───────────── localizar lançamento ───────────── */
async function findTransactionOrThrow(
  userId: string,
  m: { transactionId?: string; matchDescription?: string; matchDate?: string; matchAmountBRL?: number }
) {
  if (m.transactionId) {
    const tx = await prisma.transaction.findFirst({ where: { id: m.transactionId, userId } });
    if (!tx) throw new Error('Lançamento não encontrado para o ID informado.');
    return tx;
  }
  if (!m.matchDescription && !m.matchDate && m.matchAmountBRL === undefined) {
    throw new Error('Informe qual lançamento (descrição, data ou valor) ou o ID.');
  }
  const baseWhere = {
    userId,
    ...(m.matchAmountBRL !== undefined ? { amountInCents: brlToCents(m.matchAmountBRL) } : {}),
    ...(m.matchDate ? { date: { gte: new Date(`${m.matchDate}T00:00:00.000Z`), lte: new Date(`${m.matchDate}T23:59:59.999Z`) } } : {}),
  };
  const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = fold(m.matchDescription || '');
  const matchesNeedle = (t: { description: string; rawBankDescription: string | null }) =>
    fold(t.description).includes(needle) || fold(t.rawBankDescription || '').includes(needle);

  let hits: Awaited<ReturnType<typeof prisma.transaction.findMany>>;
  if (!needle) {
    hits = await prisma.transaction.findMany({ where: baseWhere, orderBy: { date: 'desc' }, take: 50 });
  } else {
    // 1º: busca direta no banco (todo o histórico); 2º: varredura com acentos normalizados.
    const direct = await prisma.transaction.findMany({
      where: { ...baseWhere, OR: [{ description: { contains: m.matchDescription!.trim() } }, { rawBankDescription: { contains: m.matchDescription!.trim() } }] },
      orderBy: { date: 'desc' },
      take: 50,
    });
    hits = direct.length > 0
      ? direct
      : (await prisma.transaction.findMany({ where: baseWhere, orderBy: { date: 'desc' }, take: 5000 })).filter(matchesNeedle);
  }
  if (hits.length === 0) throw new Error('Não encontrei nenhum lançamento com esses critérios.');
  if (hits.length > 1) {
    const list = hits.slice(0, 5).map((t) => `${toIso(t.date)} • ${t.description} • ${formatCentsToBRL(t.amountInCents)} (id ${t.id})`).join('; ');
    throw new Error(`Encontrei ${hits.length} lançamentos possíveis: ${list}. Informe data ou valor para eu escolher um só.`);
  }
  return hits[0];
}

function toUpdatePayload(tx: {
  id: string; type: string; nature: string; amountInCents: number; date: Date; description: string; status: string;
  sourceAccountId: string | null; destinationAccountId: string | null; creditCardId: string | null;
  categoryId: string | null; tags: string;
}) {
  return {
    id: tx.id,
    type: tx.type as 'INCOME' | 'EXPENSE' | 'TRANSFER',
    nature: tx.nature as 'STATIC' | 'VARIABLE',
    amountRaw: centsToInput(tx.amountInCents),
    date: toIso(tx.date),
    description: tx.description,
    status: tx.status as 'COMPLETED' | 'PENDING',
    paymentTarget: (tx.creditCardId ? 'CREDIT_CARD' : 'ACCOUNT') as 'CREDIT_CARD' | 'ACCOUNT',
    sourceAccountId: tx.sourceAccountId || undefined,
    destinationAccountId: tx.destinationAccountId || undefined,
    creditCardId: tx.creditCardId || undefined,
    categoryId: tx.categoryId || undefined,
    tags: tx.tags,
  };
}

/* ───────────── update_transaction ───────────── */
export const updateTransactionExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = updateTransactionToolSchema.parse(rawArgs);
    const tx = await findTransactionOrThrow(userId, parsed);
    if (tx.installmentGroupId) {
      throw new Error('Este lançamento faz parte de uma compra parcelada; edite pela tela de Extrato para não desalinhar as parcelas.');
    }

    const changes: Record<string, unknown> = {};
    const before: Array<{ label: string; value: string }> = [];
    const after: Array<{ label: string; value: string }> = [];
    const diff = (label: string, b: string, a: string) => { before.push({ label, value: b }); after.push({ label, value: a }); };

    if (parsed.description && parsed.description !== tx.description) { changes.description = parsed.description; diff('Descrição', tx.description, parsed.description); }
    if (parsed.amountBRL !== undefined && brlToCents(parsed.amountBRL) !== tx.amountInCents) {
      changes.amountRaw = centsToInput(brlToCents(parsed.amountBRL));
      diff('Valor', formatCentsToBRL(tx.amountInCents), formatCentsToBRL(brlToCents(parsed.amountBRL)));
    }
    if (parsed.date && parsed.date !== toIso(tx.date)) { changes.date = parsed.date; diff('Data', toIso(tx.date), parsed.date); }
    if (parsed.status && parsed.status !== tx.status) { changes.status = parsed.status; diff('Status', tx.status, parsed.status); }
    if (parsed.nature && parsed.nature !== tx.nature) { changes.nature = parsed.nature; diff('Natureza', tx.nature, parsed.nature); }
    if (parsed.categoryName) {
      if (tx.type === 'TRANSFER') throw new Error('Transferências não têm categoria.');
      const cat = await resolveCategory(userId, parsed.categoryName, tx.type as 'INCOME' | 'EXPENSE');
      if (cat.id !== tx.categoryId) {
        const prevCat = tx.categoryId ? await prisma.category.findFirst({ where: { id: tx.categoryId, userId } }) : null;
        changes.categoryId = cat.id;
        diff('Categoria', prevCat?.name || 'Sem categoria', cat.name);
      }
    }
    if (parsed.accountName) {
      if (tx.creditCardId) throw new Error('Este lançamento está em um cartão; a conta não se aplica.');
      const acc = await resolveActiveAccount(userId, parsed.accountName);
      if (acc.id !== tx.sourceAccountId) {
        const prevAcc = tx.sourceAccountId ? await prisma.account.findFirst({ where: { id: tx.sourceAccountId, userId } }) : null;
        changes.sourceAccountId = acc.id;
        diff('Conta', prevAcc?.name || 'Sem conta', acc.name);
      }
    }
    if (after.length === 0) throw new Error('Nenhuma alteração a aplicar: os valores informados já são os atuais.');

    return {
      title: `Editar Lançamento: ${tx.description}`,
      summary: `Alterar ${after.map((a) => a.label.toLowerCase()).join(', ')} de "${tx.description}" (${toIso(tx.date)}).`,
      beforePreview: before,
      afterPreview: after,
      beforeState: toUpdatePayload(tx),
      normalizedParams: { transactionId: tx.id, changes },
      postConfirmVisualSteps: [
        { id: 'u1', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato & Comprovantes' },
        { id: 'u2', action: 'HIGHLIGHT', targetId: 'transactions.table', caption: `Atualizando "${tx.description}"`, pauseMs: 320 },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const id = String(params.transactionId || '');
    const changes = (params.changes || {}) as Record<string, unknown>;
    const tx = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!tx) return { ok: false, verified: false, summary: 'Lançamento não encontrado.', error: 'Não encontrado.' };
    const res = await updateTransactionForUser(userId, { ...toUpdatePayload(tx), ...changes });
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
    const row = await prisma.transaction.findFirst({ where: { id, userId } });
    const verified = Boolean(
      row &&
        (changes.amountRaw === undefined || row.amountInCents === brlToCents(Number(changes.amountRaw))) &&
        (changes.description === undefined || row.description === changes.description) &&
        (changes.categoryId === undefined || row.categoryId === changes.categoryId)
    );
    return {
      ok: verified,
      verified,
      summary: verified ? `Lançamento "${row!.description}" atualizado e verificado.` : 'Não foi possível verificar a edição.',
      afterState: row,
    };
  },

  async rollback(userId, beforeState) {
    const prev = beforeState as ReturnType<typeof toUpdatePayload> | null;
    if (!prev?.id) return { ok: false, summary: 'Estado anterior indisponível.' };
    const res = await updateTransactionForUser(userId, prev);
    return res.ok ? { ok: true, summary: 'Lançamento restaurado ao estado anterior.' } : { ok: false, summary: res.error };
  },
};

/* ───────────── delete_transaction ───────────── */
export const deleteTransactionExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = deleteTransactionToolSchema.parse(rawArgs);
    const tx = await findTransactionOrThrow(userId, parsed);
    const series = parsed.deleteInstallmentSeries && tx.installmentGroupId
      ? await prisma.transaction.findMany({ where: { installmentGroupId: tx.installmentGroupId, userId } })
      : [tx];
    const total = series.reduce((s, t) => s + t.amountInCents, 0);
    return {
      title: `Excluir Lançamento: ${tx.description}`,
      summary: series.length > 1
        ? `Remover as ${series.length} parcelas de "${tx.description}" (${formatCentsToBRL(total)}). O impacto em saldo/fatura é revertido.`
        : tx.installmentGroupId
          ? `Remover SOMENTE a parcela ${tx.installmentNumber ?? '?'}/${tx.totalInstallments ?? '?'} de "${tx.description}" (${formatCentsToBRL(tx.amountInCents)}, ${toIso(tx.date)}); as demais parcelas continuam. Para remover a compra inteira, peça para excluir todas as parcelas.`
          : `Remover "${tx.description}" de ${formatCentsToBRL(tx.amountInCents)} (${toIso(tx.date)}). O impacto em saldo/fatura é revertido.`,
      beforePreview: [
        { label: 'Lançamento', value: tx.description },
        { label: 'Valor', value: formatCentsToBRL(total) },
        { label: 'Data', value: toIso(tx.date) },
      ],
      afterPreview: [{ label: 'Resultado', value: series.length > 1 ? `${series.length} parcelas excluídas` : 'Lançamento excluído' }],
      beforeState: { rows: series },
      normalizedParams: { transactionId: tx.id, deleteInstallmentSeries: series.length > 1 },
      postConfirmVisualSteps: [
        { id: 'd1', action: 'SWITCH_TAB', tab: 'transactions', targetId: 'nav.tab.transactions', caption: 'Abrindo Extrato & Comprovantes' },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const id = String(params.transactionId || '');
    const res = await deleteTransactionForUser(userId, id, Boolean(params.deleteInstallmentSeries));
    if (!res.ok) return { ok: false, verified: false, summary: res.error, error: res.error };
    const still = await prisma.transaction.findFirst({ where: { id, userId } });
    return {
      ok: !still,
      verified: !still,
      summary: !still ? 'Lançamento excluído e ausência confirmada no banco.' : 'Falha ao confirmar a exclusão.',
      afterState: { deletedId: id },
    };
  },

  async rollback(userId, beforeState) {
    const rows = (beforeState as { rows?: Array<Record<string, unknown>> } | null)?.rows;
    if (!rows?.length) return { ok: false, summary: 'Estado anterior indisponível para restaurar.' };

    const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
    const ids = (key: string) => Array.from(new Set(rows.map((r) => str(r[key])).filter((v): v is string => Boolean(v))));
    // Referências que podem ter sido removidas depois da exclusão: só religa o que ainda existe (evita erro de FK).
    const [accounts, cards, invoices, categories, rules, batches, groups] = await Promise.all([
      prisma.account.findMany({ where: { userId, id: { in: [...ids('sourceAccountId'), ...ids('destinationAccountId')] } }, select: { id: true } }),
      prisma.creditCard.findMany({ where: { userId, id: { in: ids('creditCardId') } }, select: { id: true } }),
      prisma.creditCardInvoice.findMany({ where: { id: { in: ids('invoiceId') }, creditCard: { userId } }, select: { id: true } }),
      prisma.category.findMany({ where: { userId, id: { in: ids('categoryId') } }, select: { id: true } }),
      prisma.recurrenceRule.findMany({ where: { userId, id: { in: ids('recurrenceRuleId') } }, select: { id: true } }),
      prisma.statementImportBatch.findMany({ where: { userId, id: { in: ids('importBatchId') } }, select: { id: true } }),
      prisma.installmentGroup.findMany({ where: { userId, id: { in: ids('installmentGroupId') } }, select: { id: true } }),
    ]);
    const alive = new Set([...accounts, ...cards, ...invoices, ...categories, ...rules, ...batches, ...groups].map((x) => x.id));
    const keep = (v: unknown) => { const id = str(v); return id && alive.has(id) ? id : null; };

    // Parcela avulsa: volta para a compra original se o grupo ainda existe; série inteira: recria o grupo original.
    const groupMap = new Map<string, string>();
    for (const originalGroupId of ids('installmentGroupId')) {
      if (alive.has(originalGroupId)) { groupMap.set(originalGroupId, originalGroupId); continue; }
      const series = rows.filter((r) => r.installmentGroupId === originalGroupId);
      const first = series[0];
      const g = await prisma.installmentGroup.create({
        data: {
          userId,
          description: String(first.description),
          totalAmountInCents: series.reduce((sum, r) => sum + Number(r.amountInCents), 0),
          totalInstallments: Number(first.totalInstallments) || series.length,
        },
      });
      groupMap.set(originalGroupId, g.id);
    }

    await prisma.$transaction(
      rows.map((r) =>
        prisma.transaction.create({
          data: {
            userId,
            type: String(r.type),
            nature: String(r.nature),
            amountInCents: Number(r.amountInCents),
            date: new Date(String(r.date)),
            description: String(r.description),
            status: String(r.status),
            tags: String(r.tags ?? ''),
            sourceAccountId: keep(r.sourceAccountId),
            destinationAccountId: keep(r.destinationAccountId),
            creditCardId: keep(r.creditCardId),
            invoiceId: keep(r.invoiceId),
            categoryId: keep(r.categoryId),
            recurrenceRuleId: keep(r.recurrenceRuleId),
            importBatchId: keep(r.importBatchId),
            installmentGroupId: str(r.installmentGroupId) ? groupMap.get(String(r.installmentGroupId)) ?? null : null,
            installmentNumber: (r.installmentNumber as number) ?? null,
            totalInstallments: (r.totalInstallments as number) ?? null,
            externalTransactionHash: str(r.externalTransactionHash),
            rawBankDescription: str(r.rawBankDescription),
            financialAction: str(r.financialAction),
            counterparty: str(r.counterparty),
            paymentMethod: str(r.paymentMethod),
            purpose: str(r.purpose),
            aiConfidenceScore: typeof r.aiConfidenceScore === 'number' ? r.aiConfidenceScore : null,
            aiConfidenceLevel: str(r.aiConfidenceLevel),
            isAiClassified: Boolean(r.isAiClassified),
            isUserConfirmed: r.isUserConfirmed === undefined ? true : Boolean(r.isUserConfirmed),
          },
        })
      )
    );
    return { ok: true, summary: `${rows.length} lançamento(s) restaurado(s) com os dados originais (anexos não são restaurados).` };
  },
};
