/**
 * Utilitários estritos para manipulação de valores monetários em centavos (Inteiros).
 * Evita anomalias de ponto flutuante IEEE 754 (RNF-06).
 */

export function formatCentsToBRL(cents: number, hideValue = false): string {
  if (hideValue) {
    return 'R$ ••••••';
  }
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata centavos inteiros para string de input editável (ex: 150050 -> "1500,50").
 */
export function formatCentsToInput(cents: number): string {
  const value = (cents || 0) / 100;
  return value.toFixed(2).replace('.', ',');
}

/**
 * Converte uma string de input (ex: "1.250,50" ou "1250.50" ou "7000") para centavos inteiros.
 */
export function parseInputToCents(raw: string | number): number {
  if (typeof raw === 'number') {
    return Math.round(raw * 100);
  }
  const cleaned = raw.trim().replace(/[R$\s]/g, '');
  if (!cleaned) return 0;

  // Se possui vírgula como separador decimal (padrão BR: "1.234,56")
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
  }

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '0,0%';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
