---
docId: comparison-mom
module: comparison
version: 1.1.0
screens: ["comparison"]
relatedTools: ["navigate_to_section", "compare_financial_periods", "render_visual_content", "guide_feature_workflow", "capture_annotated_screen"]
tags: ["comparativo", "comparar meses", "mom", "evolucao", "variacao", "mes anterior"]
---

# Comparativo Entre Meses (MoM)

## Onde encontrar
- Aba **Comparativo Entre Meses** (`nav.tab.comparison`).

## Como funciona
- Permite selecionar dois períodos independentes (**Período Base A** e **Período Comparado B**) com mês e ano livres (`compMonthA/compYearA` vs `compMonthB/compYearB`).
- Exibe:
  - Total gasto em cada período, categoria campeã e maior item individual de cada mês.
  - Card de **Variação de Gastos (Mês B vs Mês A)** destacando economia (verde) ou aumento (vermelho) em R$ e percentual.
  - Tabela detalhada de variação por categoria entre os dois meses.

## Regras de Negócio
- Ambos os períodos respeitam o `fiscalMonthStartDay` configurado em Configurações.
- Alterar os seletores de comparação atualiza os parâmetros de URL sem alterar o mês principal selecionado no cabeçalho.
