import { type Prisma } from "@prisma/client";
import { formatCentsToBRL, MONTH_NAMES_PT } from "@/shared/lib/currency";
import { computeDeterministicHash } from "@/features/reconciliation/parsers";
import { inferPurposeFromText } from "@/features/reconciliation/engine";
import {
  type CandidateKnowledgeDoc,
  sanitizeRetrievedContentAgainstPromptInjection,
} from "@/features/ai-copilot/rag/rag-math-and-security";

type KnowledgeTransactionInput = Prisma.TransactionGetPayload<{
  include: {
    category: true;
    sourceAccount: true;
    destinationAccount: true;
    creditCard: true;
  };
}>;
type KnowledgeRuleInput = Prisma.RecurrenceRuleGetPayload<{
  include: { category: true; account: true };
}>;
type KnowledgeGoalInput = Prisma.PortfolioGoalGetPayload<Record<string, never>>;
type KnowledgeBudgetInput = Prisma.BudgetGetPayload<{
  include: { category: true };
}>;

export function buildCandidateKnowledgeDocs(params: {
  transactions: KnowledgeTransactionInput[];
  rules: KnowledgeRuleInput[];
  goals: KnowledgeGoalInput[];
  budgets: KnowledgeBudgetInput[];
}): CandidateKnowledgeDoc[] {
  const { transactions, rules, goals, budgets } = params;
  const candidateDocs: CandidateKnowledgeDoc[] = [];

  // 1. Documentos de Transações
  for (const tx of transactions) {
    const dateIso = tx.date.toISOString().slice(0, 10);
    const [yyyy, mm, dd] = dateIso.split('-');
    const dateBr = `${dd}/${mm}/${yyyy}`;
    const mNum = Number(mm);
    const yNum = Number(yyyy);

    const typeLabel =
      tx.type === 'INCOME'
        ? 'Receita / Entrada'
        : tx.type === 'TRANSFER'
        ? 'Transferência entre Contas'
        : 'Despesa / Saída';
    const natureLabel = tx.nature === 'STATIC' ? 'Fixo / Estático' : 'Variável';
    const catName = tx.category?.name || 'Sem Categoria';
    const semantics = inferPurposeFromText(
      `${tx.description} ${tx.rawBankDescription || ''} ${catName}`,
      tx.type === 'INCOME' ? 'INFLOW' : 'OUTFLOW'
    );
    const purposeLabel = semantics.purposeLabel;
    const accountOrCard = tx.creditCard
      ? `Cartão de Crédito ${tx.creditCard.name}`
      : tx.sourceAccount
      ? `Conta ${tx.sourceAccount.name}`
      : 'Carteira';

    const safeDesc = sanitizeRetrievedContentAgainstPromptInjection(tx.description);
    const safeRaw = tx.rawBankDescription
      ? sanitizeRetrievedContentAgainstPromptInjection(tx.rawBankDescription)
      : '';
    const counterpartyInfo = tx.counterparty ? ` | Destinatário/Origem: ${tx.counterparty}` : '';
    const methodInfo = tx.paymentMethod ? ` | Meio: ${tx.paymentMethod}` : '';
    const rawInfo =
      safeRaw && safeRaw.toLowerCase() !== safeDesc.toLowerCase()
        ? ` | Extrato Original: "${safeRaw}"`
        : '';

    const title = `${dateBr} • ${safeDesc} (${formatCentsToBRL(tx.amountInCents)})`;
    const contentText = `[TRANSAÇÃO ${tx.id}] Data: ${dateBr} (${
      MONTH_NAMES_PT[mNum - 1]
    }/${yNum}) | Tipo: ${typeLabel} (${natureLabel}) | Valor: ${formatCentsToBRL(
      tx.amountInCents
    )} | Descrição: "${safeDesc}"${rawInfo} | Categoria: ${catName} | Finalidade: ${purposeLabel}${counterpartyInfo}${methodInfo} | Conta/Cartão: ${accountOrCard} | Status: ${
      tx.status === 'COMPLETED' ? 'Efetivado' : 'Previsto/Pendente'
    }${tx.tags ? ` | Tags: ${tx.tags}` : ''}`;

    candidateDocs.push({
      sourceType: 'TRANSACTION',
      sourceId: tx.id,
      referenceDate: tx.date,
      month: mNum,
      year: yNum,
      categoryId: tx.categoryId,
      amountInCents: tx.amountInCents,
      title,
      contentText,
      metadataJson: JSON.stringify({
        type: tx.type,
        nature: tx.nature,
        status: tx.status,
        categoryName: catName,
        purpose: tx.purpose || semantics.purpose,
        counterparty: tx.counterparty,
        paymentMethod: tx.paymentMethod,
      }),
      contentHash: computeDeterministicHash(contentText),
    });
  }

  // 2. Documentos de Regras Recorrentes / Custos e Ganhos Estáticos
  for (const rule of rules) {
    const safeDesc = sanitizeRetrievedContentAgainstPromptInjection(rule.description);
    const typeLabel =
      rule.type === 'INCOME' ? 'Ganho Estático Recorrente' : 'Custo Fixo / Obrigação Recorrente';
    const catName = rule.category?.name || 'Geral';
    const title = `Regra Fixa: ${safeDesc} (${formatCentsToBRL(rule.amountInCents)}/mês)`;
    const contentText = `[REGRA RECORRENTE ${rule.id}] ${typeLabel}: "${safeDesc}" | Valor Mensal Previsto: ${formatCentsToBRL(
      rule.amountInCents
    )} | Dia de Vencimento/Recebimento: Todo dia ${rule.dayOfMonth} | Categoria: ${catName} | Natureza: ${
      rule.nature === 'STATIC' ? 'Fixo / Estático' : 'Variável'
    }`;

    candidateDocs.push({
      sourceType: 'RECURRENCE_RULE',
      sourceId: rule.id,
      referenceDate: null,
      month: null,
      year: null,
      categoryId: rule.categoryId,
      amountInCents: rule.amountInCents,
      title,
      contentText,
      metadataJson: JSON.stringify({
        type: rule.type,
        nature: rule.nature,
        dayOfMonth: rule.dayOfMonth,
        categoryName: catName,
      }),
      contentHash: computeDeterministicHash(contentText),
    });
  }

  // 3. Documentos de Metas de Carteira / Patrimônio
  for (const goal of goals) {
    const safeTitle = sanitizeRetrievedContentAgainstPromptInjection(goal.title);
    const safeNotes = goal.notes
      ? sanitizeRetrievedContentAgainstPromptInjection(goal.notes)
      : '';
    const monthLabel = MONTH_NAMES_PT[(goal.targetMonth || 1) - 1] || String(goal.targetMonth);
    const title = `Meta Patrimonial: ${safeTitle} (Alvo ${formatCentsToBRL(
      goal.targetAmountInCents
    )} até ${monthLabel}/${goal.targetYear})`;
    const contentText = `[META DE CARTEIRA ${goal.id}] Título: "${safeTitle}" | Valor Alvo: ${formatCentsToBRL(
      goal.targetAmountInCents
    )} | Prazo Alvo: ${monthLabel}/${goal.targetYear} (${goal.targetMonth}/${
      goal.targetYear
    }) | Status: ${goal.status}${safeNotes ? ` | Observações: ${safeNotes}` : ''}`;

    candidateDocs.push({
      sourceType: 'PORTFOLIO_GOAL',
      sourceId: goal.id,
      referenceDate: null,
      month: goal.targetMonth,
      year: goal.targetYear,
      categoryId: null,
      amountInCents: goal.targetAmountInCents,
      title,
      contentText,
      metadataJson: JSON.stringify({
        targetMonth: goal.targetMonth,
        targetYear: goal.targetYear,
        status: goal.status,
      }),
      contentHash: computeDeterministicHash(contentText),
    });
  }

  // 4. Documentos de Orçamentos (Tetos por Categoria)
  for (const budget of budgets) {
    const catName = budget.category?.name || 'Categoria';
    const monthLabel = MONTH_NAMES_PT[(budget.month || 1) - 1] || String(budget.month);
    const title = `Orçamento ${catName} (${monthLabel}/${budget.year}): Limite ${formatCentsToBRL(
      budget.maxAmountInCents
    )}`;
    const contentText = `[ORÇAMENTO MENSAL ${budget.id}] Categoria: "${catName}" | Período: ${monthLabel}/${budget.year} | Teto Máximo de Gastos: ${formatCentsToBRL(
      budget.maxAmountInCents
    )}`;

    candidateDocs.push({
      sourceType: 'BUDGET',
      sourceId: budget.id,
      referenceDate: null,
      month: budget.month,
      year: budget.year,
      categoryId: budget.categoryId,
      amountInCents: budget.maxAmountInCents,
      title,
      contentText,
      metadataJson: JSON.stringify({
        categoryName: catName,
        month: budget.month,
        year: budget.year,
      }),
      contentHash: computeDeterministicHash(contentText),
    });
  }

  return candidateDocs;
}
