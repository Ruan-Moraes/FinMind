# Resumo para Conferência — Extratos de Teste (Novembro/2026)

Use os 3 arquivos desta pasta na aba **Leitor IA de Extratos** (pode enviar um de cada vez ou os 3 juntos!) para conferir se todos os valores, categorias e detecção de duplicidades fecham centavo por centavo.

| Extrato | Formato | Movimentações | Entradas | Saídas | Resultado Líquido |
| :--- | :---: | :---: | ---: | ---: | ---: |
| `extrato-nubank-novembro-2026.csv` | CSV | 10 (2 entradas, 8 saídas) | **R\$ 7.700,00** | **R\$ 2.972,00** | **+R\$ 4.728,00** |
| `extrato-itau-novembro-2026.ofx` | OFX | 7 (2 entradas, 5 saídas) | **R\$ 590,50** | **R\$ 1.635,90** | **-R\$ 1.045,40** |
| `extrato-mercado-pago-novembro-2026.csv` | CSV | 7 (2 entradas, 5 saídas*) | **R\$ 635,00** | **R\$ 214,30** *(R\$ 169,00 sem duplicada)* | **+R\$ 420,70** *(+R\$ 466,00 sem duplicada)* |
| **Total Consolidado (3 arquivos juntos, sem a duplicidade)** | — | **23 únicos + 1 duplicado** | **R\$ 8.925,50** | **R\$ 4.776,90** | **+R\$ 4.148,60** |

> **Teste de duplicidade proposital:** o lançamento `18/11/2026 — COMPRA NO DEBITO UBER VIAGEM (-R$ 45,30)` aparece tanto no extrato do **Nubank** quanto no do **Mercado Pago** para você validar o detector automático de duplicidades ao importar os arquivos juntos.
