---
docId: goals-and-static-rules
module: goals
version: 1.3.0
screens: ["goals", "modal:GOAL", "modal:STATIC_RULE", "modal:BUDGET", "modal:CATEGORY"]
relatedTools: ["navigate_to_section", "guide_feature_workflow", "capture_annotated_screen", "upsert_portfolio_goal", "delete_portfolio_goal", "upsert_static_rule", "upsert_category", "categorize_transactions", "upsert_budget", "delete_budget", "delete_static_rule", "set_static_rule_month", "query_budgets", "query_static_rules", "query_categories", "query_portfolio_goals"]
tags: ["meta", "carteira", "patrimonio", "metas juntas", "simulador", "custo estatico", "ganho estatico", "dia util", "orcamento", "limite de gasto", "categoria", "categorias de gastos"]
---

# Metas de Carteira, Custos Estáticos, Orçamentos e Categorias

## Onde encontrar
- Aba **Meta de Carteira & Custos Estáticos** (`nav.tab.goals`).
- Contém 4 blocos principais (cada um com seu próprio modal e `openModalType` específico — nunca confundir Meta com Categoria ou Orçamento):
  1. **Metas de Carteira & Patrimônio** (`goals.section.goals`) + **Metas Juntas** (`goals.section.combined`) — botão `goals.btn.create`, modal `GOAL`.
  2. **Custos Estáticos & Ganhos Estáticos (Linha de Base Fixa)** (`goals.section.staticRules`, tabela `goals.table.staticRules`) — botões `goals.btn.createIncomeRule` e `goals.btn.createExpenseRule`, modal `STATIC_RULE`.
  3. **Limites de Gastos por Categoria (Orçamentos Mensais)** (`goals.section.budgets`) — botão `goals.btn.createBudget` (`+ Definir Limite Mensal`), modal `BUDGET`.
  4. **Categorias de Gastos & Ganhos (Editáveis)** (`goals.section.categories`) — botões `goals.btn.createExpenseCategory` (`Nova Categoria de Gasto`), `goals.btn.createIncomeCategory` (`Nova Categoria de Ganho`) e `goals.btn.createCategory` (`+ Nova Categoria`), modal `CATEGORY`.

## Fluxo: Cadastrar ou Alterar Meta de Carteira (`modal:GOAL`)
1. Navegar até `nav.tab.goals`.
2. Clicar em **Definir Meta de Carteira** (`goals.btn.create`) para nova meta, ou no ícone de lápis em um card de meta existente para editar.
3. Preencher:
   - **Título da Meta** (`modal.goal.input.title`): ex. "Reserva de Emergência".
   - **Valor Alvo** (`modal.goal.input.targetAmount`): valor em BRL maior que zero (ex.: `2000,00`).
   - **Mês Alvo** (`modal.goal.select.month`, 1 a 12) e **Ano Alvo** (`modal.goal.input.year`, 2000 a 2100).
   - **Observações** (`modal.goal.input.notes`, opcional).
4. Clicar em **Salvar Meta** (`modal.goal.btn.submit`).

## Fluxo: Custos e Ganhos Estáticos com Dia Útil (`modal:STATIC_RULE`)
- Permite cadastrar receitas ou despesas fixas mensais (`modal.staticRule.input.description`, `modal.staticRule.input.amount`).
- No campo de vencimento/recebimento, suporta **Dia Fixo** (1 a 31) ou **Dia Útil** (1 a 23, ex.: 5º dia útil), com opção **Regra CLT (considerar sábado como dia útil)** e prévia em tempo real considerando os feriados configurados em Configurações.
- **Menu contextual (`⋯`) por regra fixa:** Cada item na tabela **Regras Fixas Mensais** possui um menu `⋯` organizado em *Apenas neste mês* (**Ajustar valor neste mês**, **Pular neste mês / Reativar neste mês**) e *Regra mensal fixa* (**Editar regra fixa**, **Excluir regra**).
- **Ajuste de valor em mês específico (`monthlyOverrides`):** Também pode ser feito clicando diretamente no valor da linha, alterando o valor apenas daquele mês sem afetar os próximos meses (com opção de restaurar ao valor base).
- **Pular mês com Desfazer (`skippedMonths`):** Qualquer regra fixa pode ser pulada em um mês específico, exibindo um banner imediato de confirmação com botão **Desfazer** em 1 clique. A regra deixa de compor os custos/ganhos estáticos, a margem livre e o ritmo das metas apenas naquele mês e volta automaticamente a contar no mês seguinte.

## Fluxo: Categorias de Gastos e Ganhos (`modal:CATEGORY`)
1. Navegar até `nav.tab.goals` e rolar até a seção **Categorias de Gastos & Ganhos (Editáveis)** (`goals.section.categories`).
2. Clicar em **Nova Categoria de Gasto** (`goals.btn.createExpenseCategory`) ou **Nova Categoria de Ganho** (`goals.btn.createIncomeCategory`) — ou clicar no ícone de lápis em um card de categoria existente para editar.
3. No modal **Nova Categoria** (`openModalType: "CATEGORY"`), preencher:
   - **Nome da Categoria** (`modal.category.input.name`): ex. Alimentação, Transporte, Assinaturas.
   - **Tipo da Categoria** (`modal.category.section.type`): **Despesa** ou **Receita**.
   - **Natureza Padrão** (`modal.category.section.nature`): **Variável** ou **Fixo / Estático**.
   - **Ícone da Categoria** (`modal.category.section.icon`) e **Cor da Categoria** (`modal.category.section.color`).
4. Clicar em **Criar Categoria** (`modal.category.btn.submit`).

## Fluxo: Limites de Gastos / Orçamentos por Categoria (`modal:BUDGET`)
1. Navegar até `nav.tab.goals` e localizar a seção **Limites de Gastos por Categoria** (`goals.section.budgets`).
2. Clicar em **+ Definir Limite Mensal** (`goals.btn.createBudget`) para abrir o modal (`openModalType: "BUDGET"`).
3. Selecionar a categoria de despesa (`modal.budget.section.category`), informar o **Teto Máximo no Mês (R$)** (`modal.budget.input.limit`) e clicar em **Salvar Limite** (`modal.budget.btn.submit`).
4. O sistema exibe alertas visuais automáticos em 70% (Atenção) e 90%+ (Crítico).

## Regras de Negócio
- O cálculo de previsão das metas prioriza o ritmo da linha de base estática (`Ganhos Estáticos - Custos Estáticos`); caso não existam regras, utiliza a média do extrato.
- **Meta Fictícia (Com Previsão de Valor):** Quando existem itens cadastrados na aba **Previsão de Valor** (`Vou Ganhar` / `Provável Gasto`), cada meta individual e o painel **Metas Juntas** exibem automaticamente um cenário simulado mês a mês mostrando o novo tempo estimado para alcançar as metas considerando essas entradas e saídas futuras. Quando não há previsões cadastradas, o sistema exibe apenas a meta normal.
- Orçamentos (`Budget`) têm chave única por `(categoria, mês, ano)`; salvar para a mesma categoria atualiza o teto existente.

## O que o Agente IA pode fazer aqui
- **Metas:** criar, alterar (informando o nome da meta existente) e excluir. Se a meta citada não for encontrada, o agente pergunta em vez de criar uma nova por engano.
- **Regras fixas:** criar, **editar** (informando a descrição atual em `matchDescription`), excluir, e ações pontuais por mês: **pular**, **reativar**, **ajustar valor só naquele mês** e **voltar ao valor base** (`set_static_rule_month`). Criar uma regra com a mesma descrição de outra existente é recusado para evitar duplicidade. Dia útil vai de 1º a 23º.
- **Orçamentos:** definir, alterar e remover o limite de uma categoria de despesa (`upsert_budget`, `delete_budget`); consultar consumo, saldo restante e status (OK, ATENÇÃO ≥70%, CRÍTICO ≥90%, ESTOURADO) com `query_budgets`.
- **Categorias:** criar/editar e classificar lançamentos em lote.
