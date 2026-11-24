import { prisma } from '@/shared/lib/prisma';

export function normalizeName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolve um item por nome: igualdade normalizada tem prioridade; depois "contém" somente se for único.
 * Nunca escolhe silenciosamente uma opção arbitrária: nome inexistente ou ambíguo gera erro explicativo.
 */
export function resolveByName<T extends { name: string }>(
  items: T[],
  requested: string,
  label: string
): T {
  const needle = normalizeName(requested);
  if (!needle) throw new Error(`Informe o nome d${label === 'conta' || label === 'categoria' ? 'a' : 'o'} ${label}.`);
  const exact = items.filter((i) => normalizeName(i.name) === needle);
  if (exact.length === 1) return exact[0];
  const partial = exact.length > 1 ? exact : items.filter((i) => normalizeName(i.name).includes(needle));
  if (partial.length === 1) return partial[0];
  const options = items.slice(0, 8).map((i) => `"${i.name}"`).join(', ') || 'nenhum cadastrado';
  if (partial.length > 1) {
    throw new Error(
      `Encontrei mais de um(a) ${label} para "${requested}": ${partial.slice(0, 6).map((i) => `"${i.name}"`).join(', ')}. Diga qual deles.`
    );
  }
  throw new Error(`Não encontrei ${label} "${requested}". Disponíveis: ${options}.`);
}

export async function resolveActiveAccount(userId: string, name?: string | null) {
  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false },
    orderBy: { createdAt: 'asc' },
  });
  if (accounts.length === 0) throw new Error('Nenhuma conta ativa cadastrada. Crie uma conta em Contas & Cartões primeiro.');
  if (!name?.trim()) {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const preferred = settings?.defaultAccountId
      ? accounts.find((a) => a.id === settings.defaultAccountId)
      : null;
    if (preferred) return preferred;
    if (accounts.length === 1) return accounts[0];
    throw new Error(
      `Em qual conta devo lançar? Disponíveis: ${accounts.slice(0, 8).map((a) => `"${a.name}"`).join(', ')}.`
    );
  }
  return resolveByName(accounts, name, 'conta');
}

export async function resolveCreditCard(userId: string, name: string) {
  const cards = await prisma.creditCard.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (cards.length === 0) throw new Error('Nenhum cartão cadastrado. Crie um cartão em Contas & Cartões primeiro.');
  return resolveByName(cards, name, 'cartão');
}

export async function resolveCategory(userId: string, name: string, type?: 'INCOME' | 'EXPENSE') {
  const categories = await prisma.category.findMany({ where: { userId, ...(type ? { type } : {}) } });
  return resolveByName(categories, name, 'categoria');
}

export function brlToCents(value: number): number {
  return Math.round(value * 100);
}
