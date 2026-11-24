# Roadmap de Implementação - Sistema Financeiro Pessoal

> **Metodologia:** Desenvolvimento incremental, testável e orientado a valor contínuo.

---

## Fase 1: Fundação do Projeto, Design System & Configurações
- [x] Inicialização do projeto Next.js 15 (App Router) com TypeScript e Tailwind CSS em `/Users/ruanmoraes/Documents/Projetos/FinMind`.
- [x] Configuração do **Design System Base** (conforme [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)):
  - Tokens de cores semânticas (Light/Dark mode) e escala de espaçamento de 4px/8px.
  - Componentes atômicos padronizados: Botões (`Primary`, `Secondary`, `Destructive`, `Ghost`) com alturas estritas (`h-8`, `h-10`, `h-12`).
  - Modais responsivos (Diálogo centralizado no desktop e Drawer/Bottom Sheet no mobile).
  - Tipografia com algarismos tabulares (`tabular-nums`) para evitar oscilações visuais de valores.
- [x] Configuração do Prisma ORM com `@prisma/adapter-libsql` e `@libsql/client`.
- [x] Criação do `prisma/schema.prisma` com os modelos validados e a tabela `UserSettings`.
- [x] Implementação de **Persistência de Tema e Preferências no Banco de Dados** (com hidratação server-side anti-flicker).
- [x] Implementação de autenticação exclusiva segura (JWT HttpOnly com bcrypt).

---

## Fase 2: Gestão de Contas Bancárias & Meios de Pagamento
- [x] Criação de contas correntes, poupanças e carteiras de dinheiro.
- [x] Cadastro de Cartões de Crédito (Limite, Dia de Fechamento, Dia de Vencimento).
- [x] Cálculo automático de saldo inicial e consolidado de cada conta (`RN-04`).
- [x] Listagem visual de contas e cartões com design moderno e responsivo.

---

## Fase 3: Núcleo de Transações & Parcelamento de Cartão
- [x] Cadastro manual ágil de receitas e despesas com categorias e tags.
- [x] Motor de cálculo para parcelamento em cartão de crédito (`RF-09` & `RN-01`):
  - Divisão automática em $N$ faturas futuras com base no dia de fechamento do cartão.
  - Vínculo a `InstallmentGroup` para edição ou cancelamento da série.
- [x] Transferências entre contas próprias.
- [x] Gerenciamento de status e pagamento de faturas (`Aberta`, `Fechada`, `Paga` - `RN-02`).

---

## Fase 4: Custos Estáticos, Metas de Carteira & Orçamentos
- [x] Cadastro e marcação de despesas e receitas como `ESTÁTICAS / INFLEXÍVEIS` vs `VARIÁVEIS`.
- [x] Cálculo da Linha de Base Financeira: **Renda Livre = Ganhos Estáticos - Custos Estáticos** + Alerta `RN-05`.
- [x] Módulo de **Meta de Carteira / Patrimônio** (ex: R$ 7.000 em tal mês):
  - Cálculo de patrimônio líquido consolidado atual (`RN-06`).
  - Indicador visual de proximidade (% atingido e R$ restante para a meta).
  - Cálculo de ritmo de aporte mensal recomendado.
- [x] Cadastro de lançamentos recorrentes/fixos (aluguel, salário, assinaturas).
- [x] Sistema de Metas e Orçamentos por categoria (com barras de progresso visuais e alertas de limite excedido).

---

## Fase 5: Anexo de Comprovantes & Upload ($0)
- [x] Suporte a anexo de comprovantes (imagens e PDFs) nos lançamentos.
- [x] Visualização e download direto dos comprovantes no modal padronizado.

---

## Fase 6: Dashboard, Comparativo Entre Meses (MoM) & Relatórios
- [x] Dashboard principal com cards de resumo (Saldo Líquido, Faturas Abertas, Entradas vs Saídas, Renda Livre).
- [x] Card de Progresso da **Meta de Carteira**.
- [x] **Módulo Comparativo Entre Meses (Month-over-Month):**
  - Comparação lado a lado (ex: Setembro vs Outubro ou Outubro vs Novembro).
  - Variação percentual e nominal de gastos.
  - Destaque automático da **categoria campeã de gastos** do mês (ex: Alimentação vs Peças).
  - Identificação do **item individual mais caro** do período.
- [x] Gráfico de gastos por categoria (Recharts).
- [x] Gráfico histórico dos últimos 6 meses.
- [x] Extrato financeiro com filtros avançados (por busca textual, categoria, tipo e natureza estática/variável).

---

## Fase 7: Otimização Mobile, PWA & Deploy de Produção ($0)
- [x] Adaptação Mobile-First com Bottom Navigation e botão flutuante (+ Lançar).
- [ ] Deploy na Vercel conectado ao GitHub e Turso Cloud (pronto para publicação).
