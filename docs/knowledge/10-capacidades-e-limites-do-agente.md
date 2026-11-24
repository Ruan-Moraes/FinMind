---
docId: agent-capabilities-and-limits
module: system
version: 1.0.0
screens: ["overview", "ai", "comparison", "goals", "forecast", "accounts", "transactions"]
relatedTools: ["query_financial_overview", "query_portfolio_goals", "query_expenses_and_transactions", "query_budgets", "query_static_rules", "query_credit_card_invoices", "query_categories", "compare_financial_periods", "query_forecasts_and_simulations", "search_financial_history", "generate_financial_report", "render_visual_content", "guide_feature_workflow", "capture_annotated_screen", "navigate_to_section"]
tags: ["agente", "capacidades", "limites", "ferramentas", "o que a ia faz", "nao consigo", "limitacao", "desfazer", "confirmacao"]
---

# Capacidades e Limites do Agente IA

## Regra de ouro
O agente só afirma que **fez** algo quando uma ferramenta real foi executada e verificada no banco. Se o pedido estiver fora da lista abaixo, ele deve **dizer claramente que não consegue** e, quando útil, mostrar na tela onde o usuário faz manualmente (`guide_feature_workflow`).

## O que o agente CONSULTA (sem confirmação)
- Visão geral, saldos, contas e cartões (`query_financial_overview`).
- Metas de carteira e progresso (`query_portfolio_goals`).
- Lançamentos e categorias do período (`query_expenses_and_transactions`).
- Orçamentos e consumo (`query_budgets`), regras fixas e situação no mês (`query_static_rules`), faturas de cartão (`query_credit_card_invoices`), lista de categorias (`query_categories`).
- Comparação de meses (`compare_financial_periods`), previsões e metas de saldo (`query_forecasts_and_simulations`), busca semântica no histórico (`search_financial_history`), relatório sob demanda (`generate_financial_report`) e gráficos/tabelas (`render_visual_content`, sempre depois de consultar dados reais).

## O que o agente ALTERA (sempre com confirmação e verificação)
- **Lançamentos:** criar (receita, despesa, transferência, cartão parcelado), editar, excluir, classificar em lote.
- **Metas de carteira:** criar, alterar, excluir. **Metas de saldo por data:** criar/alterar.
- **Regras fixas:** criar, editar, excluir, pular/reativar mês, ajustar valor em um mês.
- **Orçamentos:** definir, alterar, remover.
- **Categorias:** criar/editar.
- **Contas e cartões:** criar/editar; **pagar fatura**.
- **Previsão de valor:** criar e excluir itens.
- **Preferências:** tema, densidade, privacidade, ciclo mensal, UF e cidade.

## O que o agente NÃO faz (orientar o usuário)
- Reset geral de dados, troca de senha e gestão de chaves de API (**bloqueado** por segurança).
- Importar/conciliar extratos, sincronizar feriados, exportar ou restaurar backup/snapshot.
- Arquivar ou excluir contas e cartões; editar parcelas individuais de uma compra parcelada.
- Gerar ou excluir os diagnósticos salvos do painel de saúde financeira.
- Mudar os seletores de período A/B do Comparativo (ele consulta qualquer período por conta própria).
- Anexar comprovantes a lançamentos.

## Como o agente evita erro
- Nome de conta, cartão, categoria, meta, regra ou previsão inexistente ou ambíguo → **não grava** e lista as opções.
- Antes de editar ou excluir, ele mostra o **Antes → Depois** e espera o clique em **Confirmar e Executar**.
- Valores monetários são sempre em Reais; internamente em centavos. Projeções são estimativas, nunca garantias.
