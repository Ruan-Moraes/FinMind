import { z } from 'zod';
import type { ProviderToolDeclaration } from '@/features/ai-agent/services/agent-tool-provider-client';
import { ANALYTICS_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog-analytics';
import { CATEGORY_AND_CLASSIFICATION_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog-mutations';
import { EXTENDED_TOOL_DECLARATIONS } from '@/features/ai-agent/tools/tool-catalog-extended';

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
  categoryName: z.string().optional(),
});
export const changePeriodToolSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});
export const upsertGoalToolSchema = z.object({
  goalId: z.string().optional(), matchTitle: z.string().optional(), title: z.string().trim().min(1).optional(),
  targetAmountBRL: z.coerce.number().positive().optional(), targetMonth: z.coerce.number().int().min(1).max(12).optional(),
  targetYear: z.coerce.number().int().min(2000).max(2100).optional(), notes: z.string().optional(),
});
export const deleteGoalToolSchema = z.object({ goalId: z.string().optional(), matchTitle: z.string().min(1) });
/** Na edição (matchDescription), campos omitidos mantêm o valor atual da regra; na criação, valem os padrões. */
export const upsertStaticRuleToolSchema = z.object({
  description: z.string().trim().min(1).optional(), type: z.enum(['INCOME', 'EXPENSE']).optional(),
  amountBRL: z.coerce.number().positive().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  dayType: z.enum(['CALENDAR_DAY', 'BUSINESS_DAY']).optional(), includeSaturday: z.boolean().optional(),
  matchDescription: z.string().trim().optional(), categoryName: z.string().optional(), accountName: z.string().optional(),
  cardName: z.string().optional(), removeCard: z.boolean().optional(),
});
export const createTransactionToolSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']), nature: z.enum(['STATIC', 'VARIABLE']).default('VARIABLE'),
  description: z.string().trim().min(1), amountBRL: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), categoryName: z.string().optional(), accountName: z.string().optional(),
  destinationAccountName: z.string().optional(), cardName: z.string().optional(),
  installments: z.coerce.number().int().min(1).max(48).default(1),
  status: z.enum(['COMPLETED', 'PENDING']).default('COMPLETED'),
  tags: z.string().optional(),
});
export const upsertValueForecastToolSchema = z.object({
  matchTitle: z.string().trim().optional(),
  title: z.string().trim().min(1).optional(), type: z.enum(['INCOME', 'EXPENSE']).optional(), amountBRL: z.coerce.number().positive().optional(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes: z.string().optional(),
});
export const updatePreferencesToolSchema = z.object({
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(), density: z.enum(['COMFORTABLE', 'COMPACT']).optional(),
  hideValuesByDefault: z.boolean().optional(), fiscalMonthStartDay: z.coerce.number().int().min(1).max(28).optional(),
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
        categoryName: { type: 'string', description: 'Nome da categoria para filtrar o extrato.' },
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
    description: 'Cria uma nova Meta de Carteira (title, targetAmountBRL, targetMonth e targetYear obrigatórios) ou altera uma existente informando matchTitle — na edição, envie só os campos que mudam; os demais são mantidos. Exige confirmação.',
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
    description:
      'Cria um Custo/Ganho Estático mensal (Dia Fixo 1-31 ou Dia Útil 1-23; description, type e amountBRL obrigatórios) OU edita uma regra existente informando matchDescription (parte da descrição atual). Na edição, envie SÓ os campos que mudam: os omitidos (dia, tipo de dia, conta, cartão, categoria) são mantidos. Custo fixo pago no cartão: informe cardName; para desvincular o cartão, removeCard=true. Sem matchDescription, sempre cria uma regra nova.',
    parameters: {
      type: 'object',
      properties: {
        matchDescription: { type: 'string', description: 'Parte da descrição da regra existente a editar. Omita para criar nova.' },
        categoryName: { type: 'string' },
        accountName: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amountBRL: { type: 'number' },
        dayOfMonth: { type: 'integer' },
        dayType: { type: 'string', enum: ['CALENDAR_DAY', 'BUSINESS_DAY'] },
        includeSaturday: { type: 'boolean' },
        cardName: { type: 'string', description: 'Cartão de crédito em que o custo fixo é cobrado (somente EXPENSE).' },
        removeCard: { type: 'boolean', description: 'true para desvincular o cartão da regra.' },
      },
    },
  },
  {
    name: 'create_transaction',
    description:
      'Registra um lançamento (Receita, Despesa ou Transferência) após confirmação. Despesa no cartão: informe cardName (e installments 1-48). Transferência: informe accountName (origem) e destinationAccountName. Se a conta/categoria informada não existir, a operação é recusada com a lista de opções.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
        nature: { type: 'string', enum: ['STATIC', 'VARIABLE'] },
        description: { type: 'string' },
        amountBRL: { type: 'number', description: 'Valor total em Reais (ex: 89.9). Em parcelado, é o valor total da compra.' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        categoryName: { type: 'string' },
        accountName: { type: 'string', description: 'Conta de origem/pagamento.' },
        destinationAccountName: { type: 'string', description: 'Somente TRANSFER.' },
        cardName: { type: 'string', description: 'Cartão de crédito (somente EXPENSE).' },
        installments: { type: 'integer', description: 'Parcelas de 1 a 48 (somente com cartão).' },
        status: { type: 'string', enum: ['COMPLETED', 'PENDING'] },
        tags: { type: 'string' },
      },
      required: ['type', 'description', 'amountBRL', 'date'],
    },
  },
  {
    name: 'upsert_value_forecast',
    description: 'Adiciona um item em Previsão de Valor (Vou Ganhar = INCOME ou Provável Gasto = EXPENSE; title, type, amountBRL e expectedDate obrigatórios) OU edita um existente informando matchTitle — na edição, envie só os campos que mudam. Título repetido é recusado para não duplicar.',
    parameters: {
      type: 'object',
      properties: {
        matchTitle: { type: 'string', description: 'Título (ou parte) do item existente a editar. Omita para criar.' },
        title: { type: 'string' },
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        amountBRL: { type: 'number' },
        expectedDate: { type: 'string', description: 'YYYY-MM-DD' },
        notes: { type: 'string' },
      },
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
        fiscalMonthStartDay: { type: 'integer', description: 'Dia de início do ciclo mensal, de 1 a 28.' },
        holidayState: { type: 'string' },
        holidayCity: { type: 'string' },
      },
    },
  },
];

export const AGENT_TOOL_DECLARATIONS: ProviderToolDeclaration[] = [
  ...ANALYTICS_TOOL_DECLARATIONS,
  ...UI_AND_MUTATION_TOOL_DECLARATIONS,
  ...CATEGORY_AND_CLASSIFICATION_TOOL_DECLARATIONS,
  ...EXTENDED_TOOL_DECLARATIONS,
];
