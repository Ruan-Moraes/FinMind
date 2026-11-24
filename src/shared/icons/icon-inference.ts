import type { LucideIcon } from 'lucide-react';
import { Banknote, ICON_MAP, Landmark, PiggyBank, Tag } from '@/shared/icons/icon-catalog';

const KEYWORD_ICON_RULES: Array<{ iconId: string; exact?: string[]; includes: string[] }> = [
  {
    iconId: 'Sparkles',
    exact: ['ai', 'ia'],
    includes: ['inteligencia', 'chatgpt', 'claude', 'gemini', 'openai', 'tech', 'software'],
  },
  {
    iconId: 'ShoppingCart',
    includes: ['mercado', 'supermercado', 'atacadao', 'feira'],
  },
  {
    iconId: 'Utensils',
    includes: ['aliment', 'comida', 'restaurante', 'ifood', 'refeicao'],
  },
  {
    iconId: 'Coffee',
    includes: ['cafe', 'lanche', 'padaria'],
  },
  {
    iconId: 'Home',
    includes: ['moradia', 'aluguel', 'condominio', 'casa'],
  },
  {
    iconId: 'Wrench',
    includes: ['peca', 'oficina', 'manutencao', 'mecanico'],
  },
  {
    iconId: 'Car',
    includes: ['carro', 'transporte', 'uber', 'combustivel', 'gasolina', 'veiculo'],
  },
  {
    iconId: 'HeartPulse',
    includes: ['saude', 'farmacia', 'medico', 'hospital', 'remedio'],
  },
  {
    iconId: 'GraduationCap',
    includes: ['educacao', 'faculdade', 'curso', 'escola', 'livro'],
  },
  {
    iconId: 'Gamepad2',
    includes: ['lazer', 'jogo', 'game', 'cinema', 'streaming'],
  },
  {
    iconId: 'Wifi',
    includes: ['internet', 'wifi', 'assinatura'],
  },
  {
    iconId: 'Zap',
    includes: ['luz', 'energia', 'agua', 'gas'],
  },
  {
    iconId: 'Briefcase',
    includes: ['salario', 'trabalho', 'freela', 'pro-labore'],
  },
  {
    iconId: 'TrendingUp',
    includes: ['invest', 'rendimento', 'dividendo', 'reserva'],
  },
  {
    iconId: 'DollarSign',
    includes: ['renda', 'ganho', 'pix'],
  },
  {
    iconId: 'ShoppingBag',
    includes: ['compra', 'roupa', 'vestuario', 'shopping'],
  },
  {
    iconId: 'Plane',
    includes: ['viagem', 'passagem', 'hotel'],
  },
  {
    iconId: 'Dumbbell',
    includes: ['academia', 'treino', 'esporte'],
  },
  {
    iconId: 'Smartphone',
    includes: ['celular', 'telefone'],
  },
  {
    iconId: 'Gift',
    includes: ['presente', 'doacao'],
  },
  {
    iconId: 'ShieldCheck',
    includes: ['seguro', 'garantia'],
  },
  {
    iconId: 'Landmark',
    includes: ['imposto', 'taxa', 'banco'],
  },
];

/**
 * Resolve o identificador de ícone ideal para uma categoria (100% puro e determinístico).
 */
export function resolveCategoryIconId(
  savedIcon?: string | null,
  categoryName?: string | null
): string {
  if (savedIcon && savedIcon !== 'Tag' && ICON_MAP[savedIcon]) {
    return savedIcon;
  }

  const normalized = (categoryName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const rule of KEYWORD_ICON_RULES) {
    if (rule.exact?.includes(normalized)) {
      return rule.iconId;
    }
    if (rule.includes.some((token) => normalized.includes(token))) {
      return rule.iconId;
    }
  }

  return savedIcon && ICON_MAP[savedIcon] ? savedIcon : 'Tag';
}

export function getCategoryLucideIcon(
  savedIcon?: string | null,
  categoryName?: string | null
): LucideIcon {
  const iconId = resolveCategoryIconId(savedIcon, categoryName);
  return ICON_MAP[iconId] || Tag;
}

export function getAccountTypeIcon(type?: string): LucideIcon {
  if (type === 'SAVINGS') return PiggyBank;
  if (type === 'CASH') return Banknote;
  return Landmark;
}
