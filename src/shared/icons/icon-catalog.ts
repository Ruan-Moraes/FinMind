import {
  Sparkles,
  Utensils,
  ShoppingCart,
  Home,
  Car,
  Wrench,
  HeartPulse,
  GraduationCap,
  Gamepad2,
  Wifi,
  Zap,
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Plane,
  Dumbbell,
  Smartphone,
  Coffee,
  Gift,
  ShieldCheck,
  Landmark,
  Tag,
  Wallet,
  PiggyBank,
  Banknote,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryIconOption {
  id: string;
  label: string;
  icon: LucideIcon;
  suggestedColor: string;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { id: 'Sparkles', label: 'IA & Tech', icon: Sparkles, suggestedColor: '#6366f1' },
  { id: 'Utensils', label: 'Alimentação', icon: Utensils, suggestedColor: '#f97316' },
  { id: 'ShoppingCart', label: 'Mercado', icon: ShoppingCart, suggestedColor: '#eab308' },
  { id: 'Home', label: 'Moradia', icon: Home, suggestedColor: '#3b82f6' },
  { id: 'Car', label: 'Transporte', icon: Car, suggestedColor: '#06b6d4' },
  { id: 'Wrench', label: 'Peças & Auto', icon: Wrench, suggestedColor: '#64748b' },
  { id: 'HeartPulse', label: 'Saúde', icon: HeartPulse, suggestedColor: '#ef4444' },
  { id: 'GraduationCap', label: 'Educação', icon: GraduationCap, suggestedColor: '#8b5cf6' },
  { id: 'Gamepad2', label: 'Lazer', icon: Gamepad2, suggestedColor: '#ec4899' },
  { id: 'Wifi', label: 'Internet & Apps', icon: Wifi, suggestedColor: '#6366f1' },
  { id: 'Zap', label: 'Luz & Contas', icon: Zap, suggestedColor: '#f59e0b' },
  { id: 'Briefcase', label: 'Salário & Trabalho', icon: Briefcase, suggestedColor: '#10b981' },
  { id: 'TrendingUp', label: 'Investimentos', icon: TrendingUp, suggestedColor: '#14b8a6' },
  { id: 'DollarSign', label: 'Renda Extra', icon: DollarSign, suggestedColor: '#22c55e' },
  { id: 'ShoppingBag', label: 'Compras', icon: ShoppingBag, suggestedColor: '#d946ef' },
  { id: 'Plane', label: 'Viagens', icon: Plane, suggestedColor: '#0ea5e9' },
  { id: 'Dumbbell', label: 'Academia', icon: Dumbbell, suggestedColor: '#f43f5e' },
  { id: 'Smartphone', label: 'Celular', icon: Smartphone, suggestedColor: '#6366f1' },
  { id: 'Coffee', label: 'Café & Lanches', icon: Coffee, suggestedColor: '#d97706' },
  { id: 'Gift', label: 'Presentes', icon: Gift, suggestedColor: '#ec4899' },
  { id: 'ShieldCheck', label: 'Seguros & Taxas', icon: ShieldCheck, suggestedColor: '#475559' },
  { id: 'Landmark', label: 'Impostos & Banco', icon: Landmark, suggestedColor: '#64748b' },
  { id: 'CreditCard', label: 'Cartão & Assinatura', icon: CreditCard, suggestedColor: '#8b5cf6' },
  { id: 'Tag', label: 'Geral', icon: Tag, suggestedColor: '#6366f1' },
];

export const COLOR_SWATCH_OPTIONS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Amber/Yellow
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#64748b', // Slate
];

export const ICON_MAP: Record<string, LucideIcon> = CATEGORY_ICON_OPTIONS.reduce(
  (acc, item) => {
    acc[item.id] = item.icon;
    return acc;
  },
  {} as Record<string, LucideIcon>
);

export { Wallet, PiggyBank, Banknote, Landmark, TrendingUp, TrendingDown, Tag };
