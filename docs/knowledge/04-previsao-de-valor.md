---
docId: value-forecast
module: forecast
version: 1.1.0
screens: ["forecast"]
relatedTools: ["navigate_to_section", "query_forecasts_and_simulations", "upsert_value_forecast", "guide_feature_workflow", "capture_annotated_screen"]
tags: ["previsao", "previsao de valor", "vou ganhar", "provavel gasto", "meta de saldo", "projecao", "futuro"]
---

# Previsão de Valor e Metas de Saldo por Data

## Onde encontrar
- Aba **Previsão de Valor** (`nav.tab.forecast`).

## Funcionalidades e Operações
- **Vou Ganhar (`INCOME`):** Botão `forecast.btn.addIncome` — registra uma entrada futura prevista (ex.: bônus, 13º, reembolso) com título, valor em BRL, data prevista e observação opcional.
- **Provável Gasto (`EXPENSE`):** Botão `forecast.btn.addExpense` — registra uma despesa futura prevista (ex.: IPVA, viagem, compra planejada).
- **Metas de Saldo por Data (`BalanceTargetCheck`):** Botão `forecast.btn.addTarget` — define quanto o usuário deseja ter acumulado em uma data específica e calcula automaticamente se o saldo projetado (patrimônio atual + eventos futuros até a data) alcança o alvo ou quanto falta.

## Regras de Negócio e Validações
- Itens de previsão **não alteram** o saldo atual das contas bancárias nem o extrato real; eles alimentam exclusivamente a projeção futura.
- Exclusões de eventos previstos ou metas de saldo sempre exigem confirmação prévia antes da remoção definitiva.
- Datas devem estar em formato válido `YYYY-MM-DD` e valores devem ser maiores que R$ 0,00.
