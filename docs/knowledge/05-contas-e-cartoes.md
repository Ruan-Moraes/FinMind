---
docId: accounts-and-cards
module: accounts
version: 1.0.0
screens: ["accounts", "modal:ACCOUNT", "modal:CARD", "modal:PAY_INVOICE"]
relatedTools: ["navigate_to_section", "upsert_account", "upsert_credit_card", "pay_credit_card_invoice", "guide_feature_workflow"]
tags: ["conta", "carteira", "banco", "saldo", "cartao", "cartao de credito", "fatura", "limite", "fechamento", "vencimento"]
---

# Contas Bancárias e Cartões de Crédito

## Onde encontrar
- Aba **Contas & Cartões** (`nav.tab.accounts`).

## Contas Bancárias (`modal:ACCOUNT`)
- Botão **Nova Conta** (`accounts.btn.createAccount`).
- Tipos aceitos: Conta Corrente (`CHECKING`), Poupança/Investimento (`SAVINGS`) e Dinheiro/Carteira (`CASH`).
- Possui saldo inicial (`initialBalanceInCents`) e cor identificadora. O saldo atual é calculado dinamicamente: `saldo inicial + receitas concluídas + transferências recebidas - despesas concluídas - transferências enviadas`.
- Contas podem ser **arquivadas** (preservando histórico sem compor o saldo consolidado ativo) ou excluídas.

## Cartões de Crédito (`modal:CARD`) e Faturas (`modal:PAY_INVOICE`)
- Botão **Novo Cartão** (`accounts.btn.createCard`).
- Campos: Nome, Bandeira, Limite Total (`limitInCents`), Dia de Fechamento (`closingDay`, 1 a 31) e Dia de Vencimento (`dueDay`, 1 a 31).
- **Pagamento de Fatura:** Seleciona a conta pagadora e registra o pagamento da fatura mensal, atualizando o status da fatura para `PAID` e debitando o valor da conta escolhida.
