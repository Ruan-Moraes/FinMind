---
docId: overview-and-navigation
module: overview
version: 1.0.0
screens: ["overview", "header"]
relatedTools: ["navigate_to_section", "change_period", "update_user_preferences", "guide_feature_workflow", "capture_annotated_screen"]
tags: ["visao geral", "dashboard", "header", "navegacao", "periodo", "mes", "ano", "tema", "privacidade", "kpi"]
---

# Visão Geral e Navegação Global

## Onde encontrar
- **Cabeçalho (Header):** Sempre visível no topo em todas as abas. Contém:
  - Seletor de Mês (`header.period.month`) e Ano (`header.period.year`) vigentes.
  - Seletor de Modelo de IA (`header.model.selector`).
  - Alternar Modo Privacidade (`header.btn.privacy`).
  - Alternar Tema Claro/Escuro (`header.btn.theme`).
  - Abrir Configurações & Preferências (`header.btn.settings`).
  - Atalho global **Novo Lançamento** (`header.btn.newTx`).
- **Barra de Abas (7 módulos):**
  1. **Visão Geral** (`nav.tab.overview`)
  2. **Copiloto IA & Extrato** (`nav.tab.ai`)
  3. **Comparativo Entre Meses** (`nav.tab.comparison`)
  4. **Meta de Carteira & Custos Estáticos** (`nav.tab.goals`)
  5. **Previsão de Valor** (`nav.tab.forecast`)
  6. **Contas & Cartões** (`nav.tab.accounts`)
  7. **Extrato & Comprovantes** (`nav.tab.transactions`)

## Componentes da Visão Geral
- **Cartões de KPI:** Saldo Consolidado em Contas, Receitas do Mês, Despesas do Mês e Margem Livre Estática.
- **Destaques do Mês:** Categoria campeã de gastos, item individual mais caro, total de custos estáticos e gastos variáveis, com atalho para o Comparativo Entre Meses.
- **Gráficos:** Evolução de receitas vs. despesas nos últimos 6 meses e distribuição de gastos por categoria.
- **Alerta de Comprometimento Fixo:** Exibido no topo caso os custos estáticos ultrapassem os ganhos estáticos garantidos.

## Pré-condições e Efeitos Colaterais
- Trocar o período (`change_period`) atualiza os parâmetros `month` e `year` na URL e recarrega todas as métricas, extrato, faturas e orçamentos do mês escolhido.
