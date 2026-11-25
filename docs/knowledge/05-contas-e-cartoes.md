---
docId: accounts-and-cards
module: accounts
version: 1.3.0
screens: ["accounts", "modal:ACCOUNT", "modal:CARD", "modal:PAY_INVOICE"]
relatedTools: ["navigate_to_section", "guide_feature_workflow", "capture_annotated_screen", "query_financial_overview", "upsert_account", "upsert_credit_card", "pay_credit_card_invoice", "query_credit_card_invoices"]
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
- **Lançar Compra:** cada card de cartão tem o botão **Lançar Compra**, que abre o formulário de lançamento já como despesa no cartão selecionado.
- **Custos fixos no cartão:** regras fixas de despesa vinculadas a um cartão (ex.: assinaturas) entram no **limite usado** do cartão enquanto a fatura do mês não está paga e ainda não foram lançadas; o card mostra "Inclui R$ X em custos fixos vinculados a este cartão".

## O que o Agente IA pode fazer aqui
- **Contas e cartões:** criar ou editar (informando o nome atual em `matchName`). Na edição, só os campos citados mudam (tipo da conta, bandeira, limite, dias e cor são mantidos). Nomes duplicados são recusados. Arquivar/excluir contas e cartões **não** é feito pelo agente — use a tela.
- **Faturas:** consultar (`query_credit_card_invoices`: mês, status, total, vencimento) e **pagar** (`pay_credit_card_invoice`) escolhendo a conta pagadora. O pagamento gera um lançamento de despesa na conta e marca a fatura como paga; ao desfazer, a fatura reabre e o lançamento é removido.
