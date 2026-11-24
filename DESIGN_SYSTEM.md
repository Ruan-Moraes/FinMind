# Especificação do Design System & Padronização de UI

> **Padrão Visual:** Fintech Moderna (estilo Linear / Stripe / Nubank)  
> **Filosofia:** Rigor métrico, tipografia tabular, contraste preciso e transições fluidas.  
> **Aderência:** 100% dos componentes e telas devem seguir estas diretrizes.

---

## 1. Princípios de Design

1. **Rigor Métrico (Grid de 4px / 8px):** Espaçamentos, alturas e larguras nunca são arbitrários; sempre múltiplos da escala base de 4px (`gap-1`, `gap-2`, `gap-4`, `p-6`).
2. **Números Tabulares (`tabular-nums`):** Todos os valores monetários e datas usam algarismos com largura monoespaçada idêntica, impedindo que os números "fiquem dançando" na tela quando atualizados.
3. **Ergonomia Mobile-First (Thumb Zone):** Em telas móveis (< 640px), modais abrem como **Bottom Sheets** (gavetas que sobem do rodapé), facilitando o alcance do polegar.
4. **Semântica Visual de Cores:** Cores nunca são decorativas; indicam com clareza a natureza do fluxo financeiro:
   * **Verde (Emerald):** Receitas e metas atingidas.
   * **Vermelho (Rose):** Despesas e orçamentos estourados.
   * **Azul/Índigo:** Transferências entre contas e saldos neutros.
   * **Âmbar/Laranja:** Alertas de limite (70%-90%) e contas a vencer em breve.
   * **Cinza / Slate:** Custos estáticos / fixos (sobriedade e estabilidade).

---

## 2. Paleta de Cores e Tokens de Tema

As cores respeitam estritamente o contraste **WCAG AA / AAA**.

| Token Semântico | Modo Claro (Light) | Modo Escuro (Dark) | Aplicação |
| :--- | :--- | :--- | :--- |
| `background` | `#ffffff` | `#09090b` (Zinc 950) | Fundo principal da página |
| `card` | `#f8fafc` (Slate 50) | `#18181b` (Zinc 900) | Superfície de cards e modais |
| `card-hover` | `#f1f5f9` (Slate 100) | `#27272a` (Zinc 800) | Feedback de hover em cards clicáveis |
| `border` | `#e2e8f0` (Slate 200) | `#27272a` (Zinc 800) | Bordas sutis de separação |
| `text-primary` | `#0f172a` (Slate 900) | `#f8fafc` (Slate 50) | Títulos e números em destaque |
| `text-muted` | `#64748b` (Slate 500) | `#a1a1aa` (Zinc 400) | Legendas, subtítulos e datas |
| `income` | `#10b981` (Emerald 500) | `#34d399` (Emerald 400) | Valores de entrada |
| `income-bg` | `#ecfdf5` (Emerald 50) | `#064e3b` (Emerald 900/30) | Badges e pílulas de receita |
| `expense` | `#f43f5e` (Rose 500) | `#fb7185` (Rose 400) | Valores de saída |
| `expense-bg` | `#fff1f2` (Rose 50) | `#881337` (Rose 900/30) | Badges e pílulas de despesa |

---

## 3. Escala Tipográfica Padronizada

Utilização da fonte **Geist Sans** ou **Inter**, com pesos estritos: `Regular (400)`, `Medium (500)` e `Semi-Bold (600)`.

| Token | Tamanho | Entrelinha | Uso Exclusivo |
| :--- | :--- | :--- | :--- |
| `text-xs` | 12px | 16px | Tags, badges, horários e legendas secundárias |
| `text-sm` | 14px | 20px | Textos de inputs, botões padrão, células de tabela |
| `text-base` | 16px | 24px | Corpo de texto principal e descrições |
| `text-lg` | 18px | 28px | Títulos de cards e modais |
| `text-xl` | 20px | 28px | Cabeçalhos de seção |
| `text-2xl` | 24px | 32px | Título principal das páginas |
| `text-3xl` | 30px | 36px | **Saldo Consolidado e Metas em Destaque** (`tabular-nums font-semibold`) |

---

## 4. Matriz de Botões e Estados Interativos

Todos os botões possuem altura padronizada, foco acessível (`focus-visible:ring-2`) e estado de loading nativo com spinner que não altera o tamanho do botão.

```
+-------------------------------------------------------------------------+
| Alturas Padrão:                                                         |
| • Small: h-8 (32px), px-3, text-xs                                       |
| • Medium: h-10 (40px), px-4, text-sm (Padrão para formulários)          |
| • Large: h-12 (48px), px-6, text-base (Ações principais / Mobile FAB)   |
+-------------------------------------------------------------------------+
```

| Variante | Estilo Visual | Quando Usar |
| :--- | :--- | :--- |
| **Primary (Solid)** | Fundo preto no Light (`bg-zinc-900 text-white`) / Fundo branco no Dark (`dark:bg-zinc-50 dark:text-zinc-900`) | Ação principal da tela (ex: "Salvar Lançamento") |
| **Secondary (Outline)** | Borda sutil com fundo transparente (`border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800`) | Ações secundárias (ex: "Cancelar", "Filtrar") |
| **Destructive (Rose)** | `bg-rose-600 text-white hover:bg-rose-700` | Exclusões irreversíveis com confirmação |
| **Ghost / Minimal** | Sem borda nem fundo, apenas hover sutil (`hover:bg-zinc-100 dark:hover:bg-zinc-800`) | Ações de tabela, fechar modais e paginação |

---

## 5. Padronização de Modais e Diálogos

Nenhum modal é criado sem seguir estritamente este layout:

```
+-------------------------------------------------------+
|  [Header]                                             |
|  Título do Modal (text-lg font-semibold)        [X]   |
|  Subtítulo explicativo curto (text-sm text-muted)    |
+-------------------------------------------------------+
|  [Body]                                               |
|  Grid de Formulário com espaçamento vertical (space-y-4) |
|  - Label clara e concisa                              |
|  - Input com borda padronizada e foco suave           |
|  - Mensagem de erro em texto-xs vermelho se inválido  |
+-------------------------------------------------------+
|  [Footer] (border-t border-zinc-200 dark:border-zinc-800) |
|                         [ Cancelar ]  [ Salvar (Primary) ] |
+-------------------------------------------------------+
```

* **Desktop:** Diálogo centralizado com largura máxima fixa (`max-w-lg` ou `max-w-md`), fundo com efeito vidro (`backdrop-blur-sm bg-black/40`) e animação suave de fade-in + scale.
* **Mobile (< 640px):** Automaticamente se transforma em **Drawer/Bottom Sheet**, ancorado na base da tela com uma barra puxadora central no topo (`w-12 h-1.5 rounded-full bg-zinc-300`).

---

## 6. Persistência de Configurações do Usuário no Banco de Dados

Todas as preferências do usuário são salvas de forma atômica no banco de dados (tabela `USER_SETTINGS`), sincronizando imediatamente no cliente sem *flicker* (sem piscar tema na troca de página).

### Estrutura das Configurações Salvas no Banco:
```typescript
interface UserSettings {
  id: string;
  userId: string;
  
  // Tema e Interface
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';      // Tema persistido no banco
  density: 'COMFORTABLE' | 'COMPACT';     // Densidade visual de linhas e tabelas
  
  // Privacidade & Usabilidade
  hideValuesByDefault: boolean;           // Modo privacidade (oculta R$ com ••••••)
  
  // Regras de Fechamento Pessoal
  fiscalMonthStartDay: number;            // 1 a 31 (ex: dia 5, quando cai o salário)
  defaultAccountId?: string;              // Conta pré-selecionada ao abrir modal de despesa
  
  updatedAt: Date;
}
```

* **Zero Flicker de Tema:** O tema selecionado é injetado diretamente no Server Component inicial via classe CSS no `<html>`, garantindo que não ocorra a "piscada branca" ao recarregar a tela no modo escuro.
