---
docId: goals-and-static-rules
module: goals
version: 1.0.0
screens: ["goals", "modal:GOAL", "modal:STATIC_RULE", "modal:BUDGET", "modal:CATEGORY"]
relatedTools: ["navigate_to_section", "upsert_portfolio_goal", "delete_portfolio_goal", "upsert_static_rule", "delete_static_rule", "upsert_budget", "upsert_category", "guide_feature_workflow"]
tags: ["meta", "carteira", "patrimonio", "metas juntas", "simulador", "custo estatico", "ganho estatico", "dia util", "orcamento", "categoria"]
---

# Metas de Carteira, Custos Estáticos, Orçamentos e Categorias

## Onde encontrar
- Aba **Meta de Carteira & Custos Estáticos** (`nav.tab.goals`).
- Contém 4 blocos principais:
  1. **Metas de Carteira & Patrimônio** + card **Metas Juntas (Projeção Consolidada & Simulador)** — botão `goals.btn.create`.
  2. **Custos Estáticos & Ganhos Estáticos (Linha de Base Fixa)** — botões `goals.btn.createIncomeRule` e `goals.btn.createExpenseRule`, tabela de regras planejadas (com status *Já caiu no mês* / *Aguardando no mês*) e tabela de lançamentos fixos já caídos.
  3. **Orçamentos Mensais por Categoria** — botão `goals.btn.createBudget`.
  4. **Categorias Personalizadas** — botão `goals.btn.createCategory`.

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
- **Pular mês (`Pular mês` / `Reativar`):** Qualquer regra fixa pode ser pulada em um mês específico (`skippedMonths`), deixando de compor os custos/ganhos estáticos, a margem livre e o ritmo das metas apenas naquele mês e voltando automaticamente a contar no mês seguinte.

## Regras de Negócio
- O cálculo de previsão das metas prioriza o ritmo da linha de base estática (`Ganhos Estáticos - Custos Estáticos`); caso não existam regras, utiliza a média do extrato.
- **Meta Fictícia (Com Previsão de Valor):** Quando existem itens cadastrados na aba **Previsão de Valor** (`Vou Ganhar` / `Provável Gasto`), cada meta individual e o painel **Metas Juntas** exibem automaticamente um cenário simulado mês a mês mostrando o novo tempo estimado para alcançar as metas considerando essas entradas e saídas futuras. Quando não há previsões cadastradas, o sistema exibe apenas a meta normal.
- Orçamentos (`Budget`) têm chave única por `(categoria, mês, ano)`; salvar para a mesma categoria atualiza o teto existente.
