import { z } from 'zod';
import type { ProviderToolDeclaration } from '@/features/ai-agent/services/agent-tool-provider-client';
import { ANALYTICS_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog-analytics';

const TAB_ENUM = ['overview', 'ai', 'comparison', 'goals', 'forecast', 'accounts', 'transactions'] as const;

const MODAL_ENUM = ['GOAL', 'STATIC_RULE', 'BUDGET', 'CATEGORY', 'TX', 'ACCOUNT', 'CARD', 'SETTINGS'] as const;

export const navigateToolSchema = z.object({ tab: z.enum(TAB_ENUM), targetId: z.string().optional(), reason: z.string().optional() });
export const guideWorkflowToolSchema = z.object({
  tab: z.enum(TAB_ENUM), topic: z.string().min(1), highlightTargetId: z.string().optional(),
  openModalType: z.enum(MODAL_ENUM).optional(),
});
export const captureScreenToolSchema = z.object({
  tab: z.enum(TAB_ENUM), title: z.string().min(1),
  openModalType: z.enum(MODAL_ENUM).optional(),
  annotations: z.array(z.object({ targetId: z.string().min(1), label: z.string().min(1) })).min(1).max(5),
});
export const applyTxFiltersToolSchema = z.object({
  searchQuery: z.string().optional(),
  filterType: z.enum(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  filterNature: z.enum(['ALL', 'STATIC', 'VARIABLE']).optional(),
});
export const changePeriodToolSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});
export const upsertGoalToolSchema = z.object({
  goalId: z.string().optional(), matchTitle: z.string().optional(), title: z.string().trim().min(1),
  targetAmountBRL: z.coerce.number().positive(), targetMonth: z.coerce.number().int().min(1).max(12),
  targetYear: z.coerce.number().int().min(2000).max(2100), notes: z.string().optional(),
});
export const deleteGoalToolSchema = z.object({ goalId: z.string().optional(), matchTitle: z.string().min(1) });
export const upsertStaticRuleToolSchema = z.object({
  description: z.string().trim().min(1), type: z.enum(['INCOME', 'EXPENSE']), amountBRL: z.coerce.number().positive(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).default(5),
  dayType: z.enum(['CALENDAR_DAY', 'BUSINESS_DAY']).default('CALENDAR_DAY'), includeSaturday: z.boolean().default(false),
});
export const createTransactionToolSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']), nature: z.enum(['STATIC', 'VARIABLE']).default('VARIABLE'),
  description: z.string().trim().min(1), amountBRL: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), categoryName: z.string().optional(), accountName: z.string().optional(),
  status: z.enum(['COMPLETED', 'PENDING']).default('COMPLETED'),
});
export const upsertValueForecastToolSchema = z.object({
  title: z.string().trim().min(1), type: z.enum(['INCOME', 'EXPENSE']), amountBRL: z.coerce.number().positive(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().optional(),
});
export const updatePreferencesToolSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(), density: z.enum(['COMFORTABLE', 'COMPACT']).optional(),
  hideValuesByDefault: z.boolean().optional(), fiscalMonthStartDay: z.coerce.number().int().min(1).max(31).optional(),
  holidayState: z.string().trim().max(2).nullable().optional(), holidayCity: z.string().trim().max(120).nullable().optional(),
});

const UI_AND_MUTATION_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  {
    name: 'navigate_to_section',
    description:
      'Navega visualmente até uma aba específica do FinMind. Use SOMENTE quando o usuário pedir explicitamente para abrir, ir para ou ver a tela/aba em si. NUNCA use para responder pedidos de gráficos, análises, comparações ou relatórios.',
    parameters: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['overview', 'ai', 'comparison', 'goals', 'forecast', 'accounts', 'transactions'] },
        targetId: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['tab'],
    },
  },
  {
    name: 'open_settings',
    description:
      'Abre o modal de Configurações & Preferências. Use SOMENTE quando o usuário pedir explicitamente para abrir as configurações (não para ensinar passo a passo — nesse caso use guide_feature_workflow).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'guide_feature_workflow',
    description:
      'Demonstra visualmente passo a passo com destaque e tooltips como usar ou configurar uma funcionalidade (sem salvar sozinho). Pode ser combinada com uma ferramenta de mutação quando o usuário pedir para ensinar E configurar ao mesmo tempo.',
    parameters: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['overview', 'ai', 'comparison', 'goals', 'forecast', 'accounts', 'transactions'] },
        topic: { type: 'string' },
        highlightTargetId: { type: 'string' },
        openModalType: {
          type: 'string',
          enum: ['GOAL', 'STATIC_RULE', 'BUDGET', 'CATEGORY', 'TX', 'ACCOUNT', 'CARD', 'SETTINGS'],
          description:
            'Modal exato a abrir na demonstração: CATEGORY (Categorias de gastos/ganhos), BUDGET (Limites/orçamentos por categoria), GOAL (Metas de carteira), STATIC_RULE (Custos/ganhos estáticos), TX (Lançamento), ACCOUNT (Conta), CARD (Cartão), SETTINGS (Configurações/feriados/tema/backup).',
        },
      },
      required: ['tab', 'topic'],
    },
  },
  {
    name: 'capture_annotated_screen',
    description: 'Captura uma imagem real da interface atual ou de uma aba/modal específico com marcações numeradas.',
    parameters: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['overview', 'ai', 'comparison', 'goals', 'forecast', 'accounts', 'transactions'] },
        title: { type: 'string' },
        openModalType: {
          type: 'string',
          enum: ['GOAL', 'STATIC_RULE', 'BUDGET', 'CATEGORY', 'TX', 'ACCOUNT', 'CARD', 'SETTINGS'],
        },
        annotations: {
          type: 'array',
          items: {
            type: 'object',
            properties: { targetId: { type: 'string' }, label: { type: 'string' } },
            required: ['targetId', 'label'],
          },
        },
      },
      required: ['tab', 'title', 'annotations'],
    },
  },
  {
    name: 'apply_transaction_filters',
    description: 'Navega para Extrato & Comprovantes e aplica busca textual, tipo ou natureza nos lançamentos.',
    parameters: {
      type: 'object',
      properties: {
        searchQuery: { type: 'string' },
        filterType: { type: 'string', enum: ['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] },
        filterNature: { type: 'string', enum: ['ALL', 'STATIC', 'VARIABLE'] },
      },
    },
  },
  {
    name: 'change_period',
    description: 'Altera o mês e ano exibidos no dashboard financeiro.',
    parameters: {
      type: 'object',
      properties: { month: { type: 'integer' }, year: { type: 'integer' } },
      required: ['month', 'year'],
    },
  },
  {
    name: 'upsert_portfolio_goal',
    description: 'Cria uma nova Meta de Carteira ou altera uma meta existente (exige confirmação do usuário).',
    parameters: {
      type: 'object',
      properties: {
        matchTitle: { type: 'string', description: 'Parte do título da meta existente a editar, se for alteração' },
        title: { type: 'string' },
        targetAmountBRL: { type: 'number', description: 'Valor alvo em Reais (ex: 2000)' },
        targetMonth: { type: 'integer' },
        targetYear: { type: 'integer' },
        notes: { type: 'string' },
      },
      required: ['title', 'targetAmountBRL', 'targetMonth', 'targetYear'],
    },
  },
  {
    name: 'delete_portfolio_goal',
    description: 'Remove uma Meta de Carteira existente (operação sensível L3 — exige confirmação explícita do usuário).',
    parameters: {
      type: 'object',
      properties: {
        matchTitle: { type: 'string', description: 'Título ou parte do título da meta a excluir.' },
      },
      required: ['matchTitle'],
    },
  },
  {
    name: 'upsert_static_rule',
    description: 'Cria um Custo Estático ou Ganho Estático mensal (suporta Dia Fixo ou Dia Útil).',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amountBRL: { type: 'number' },
        dayOfMonth: { type: 'integer' },
        dayType: { type: 'string', enum: ['CALENDAR_DAY', 'BUSINESS_DAY'] },
        includeSaturday: { type: 'boolean' },
      },
      required: ['description', 'type', 'amountBRL'],
    },
  },
  {
    name: 'create_transaction',
    description: 'Registra um novo lançamento financeiro (Receita ou Despesa) após confirmação.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
        nature: { type: 'string', enum: ['STATIC', 'VARIABLE'] },
        description: { type: 'string' },
        amountBRL: { type: 'number' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        categoryName: { type: 'string' },
        accountName: { type: 'string' },
      },
      required: ['type', 'description', 'amountBRL', 'date'],
    },
  },
  {
    name: 'upsert_value_forecast',
    description: 'Adiciona um item em Previsão de Valor (Vou Ganhar ou Provável Gasto).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amountBRL: { type: 'number' },
        expectedDate: { type: 'string', description: 'YYYY-MM-DD' },
        notes: { type: 'string' },
      },
      required: ['title', 'type', 'amountBRL', 'expectedDate'],
    },
  },
  {
    name: 'update_user_preferences',
    description: 'Altera configurações do usuário: tema, densidade, modo privacidade, início do ciclo mensal, Estado (UF) ou Cidade.',
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['LIGHT', 'DARK', 'SYSTEM'] },
        density: { type: 'string', enum: ['COMFORTABLE', 'COMPACT'] },
        hideValuesByDefault: { type: 'boolean' },
        fiscalMonthStartDay: { type: 'integer' },
        holidayState: { type: 'string' },
        holidayCity: { type: 'string' },
      },
    },
  },
];

export const AGENT_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  ...ANALYTICS_TOOL_DECLARATIONS,
  ...UI_AND_MUTATION_TOOL_DECLARATIONS,
];
