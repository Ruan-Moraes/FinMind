export interface DefaultCategorySeed {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  defaultNature: 'STATIC' | 'VARIABLE';
  color: string;
  icon: string;
}

/**
 * Fonte única de verdade para categorias padrão criadas no bootstrap e no reset financeiro.
 */
export const DEFAULT_CATEGORIES: ReadonlyArray<DefaultCategorySeed> = [
  { name: 'Salário & Remuneração', type: 'INCOME', defaultNature: 'STATIC', color: '#10b981', icon: 'Briefcase' },
  { name: 'Rendimentos & Investimentos', type: 'INCOME', defaultNature: 'VARIABLE', color: '#059669', icon: 'TrendingUp' },
  { name: 'Outras Receitas & Pix', type: 'INCOME', defaultNature: 'VARIABLE', color: '#34d399', icon: 'ArrowDownLeft' },
  { name: 'Moradia & Contas Fixas', type: 'EXPENSE', defaultNature: 'STATIC', color: '#6366f1', icon: 'Home' },
  { name: 'Alimentação & Delivery', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#f59e0b', icon: 'Utensils' },
  { name: 'Supermercado', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#eab308', icon: 'ShoppingCart' },
  { name: 'Transporte & Mobilidade', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#3b82f6', icon: 'Car' },
  { name: 'Assinaturas & Serviços Digitais', type: 'EXPENSE', defaultNature: 'STATIC', color: '#8b5cf6', icon: 'Tv' },
  { name: 'Saúde & Academia', type: 'EXPENSE', defaultNature: 'STATIC', color: '#ec4899', icon: 'Heart' },
  { name: 'Compras & Lazer', type: 'EXPENSE', defaultNature: 'VARIABLE', color: '#f97316', icon: 'ShoppingBag' },
  { name: 'Impostos, Seguros & Tarifas', type: 'EXPENSE', defaultNature: 'STATIC', color: '#64748b', icon: 'Shield' },
];
