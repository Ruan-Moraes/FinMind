---
docId: accounts-and-cards
module: accounts
version: 1.1.0
screens: ["accounts", "modal:ACCOUNT", "modal:CARD", "modal:PAY_INVOICE"]
relatedTools: ["navigate_to_section", "guide_feature_workflow", "capture_annotated_screen", "query_financial_overview"]
tags: ["conta", "carteira", "banco", "saldo", "cartao", "cartao de credito", "fatura", "limite", "fechamento", "vencimento"]
---

# Contas Bancárias e Cartões de Crédito

## Onde encontrar
- Aba **Contas & Cartões** (`nav.tab.accounts`).

## Contas Bancárias (`modal:ACCOUNT`)
- Botão **Nova Conta** (`accounts.btn.createAccount`) abre o modal `openModalType: "ACCOUNT"`.
- Campos: **Nome da Conta** (`modal.account.input.name`), **Tipo de Conta** (`modal.account.section.type`: `CHECKING`, `SAVINGS`, `CASH`), cor e **Saldo Inicial** (`modal.account.input.initialBalance`), confirmando em `modal.account.btn.submit`.
- O saldo atual é calculado dinamicamente: `saldo inicial + receitas concluídas + transferências recebidas - despesas concluídas - transferências enviadas`.
- Contas podem ser **arquivadas** (preservando histórico sem compor o saldo consolidado ativo) ou excluídas.

## Cartões de Crédito (`modal:CARD`) e Faturas (`modal:PAY_INVOICE`)
- Botão **Novo Cartão** (`accounts.btn.createCard`) abre o modal `openModalType: "CARD"`.
- Campos: **Nome do Cartão** (`modal.card.input.name`), **Bandeira** (`modal.card.section.brand`), **Limite Total** (`modal.card.input.limit`), **Dia Fechamento** (`modal.card.input.closingDay`) e **Dia Vencimento** (`modal.card.input.dueDay`), confirmando em `modal.card.btn.submit`.
- **Pagamento de Fatura:** Seleciona a conta pagadora e registra o pagamento da fatura mensal, atualizando o status da fatura para `PAID` e debitando o valor da conta escolhida.
