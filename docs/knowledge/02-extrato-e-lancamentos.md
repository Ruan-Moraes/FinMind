---
docId: transactions-and-ledger
module: transactions
version: 1.0.0
screens: ["transactions", "modal:TX"]
relatedTools: ["navigate_to_section", "apply_transaction_filters", "create_transaction", "update_transaction", "delete_transaction", "guide_feature_workflow"]
tags: ["extrato", "lancamento", "transacao", "despesa", "receita", "transferencia", "parcelamento", "filtro", "comprovante"]
---

# Extrato, Lançamentos e Comprovantes

## Onde encontrar
- Aba **Extrato & Comprovantes** (`nav.tab.transactions`) para listar, buscar, filtrar, editar, marcar como pago/pendente, anexar comprovantes ou excluir lançamentos do mês vigente.
- Botão global **Novo Lançamento** (`header.btn.newTx`) no cabeçalho ou dentro da aba de Extrato para abrir o modal de lançamento (`modal:TX`).

## Filtros Disponíveis no Extrato
- **Busca textual** (`transactions.filter.search`): pesquisa por descrição, categoria, tags, conta ou cartão.
- **Tipo** (`transactions.filter.type`): `ALL` (Todos), `INCOME` (Receitas), `EXPENSE` (Despesas), `TRANSFER` (Transferências).
- **Natureza** (`transactions.filter.nature`): `ALL` (Todas), `STATIC` (Fixo / Estático), `VARIABLE` (Variável).
- **Categoria** (`transactions.filter.category`): filtra por qualquer categoria cadastrada.

## Campos e Regras do Modal de Lançamento (`modal:TX`)
- **Tipo (`INCOME`, `EXPENSE`, `TRANSFER`):** Transferências exigem conta de origem e conta de destino diferentes.
- **Natureza (`STATIC`, `VARIABLE`):** Define se entra na linha de base fixa ou nos gastos variáveis.
- **Valor (`modal.tx.input.amount`):** Obrigatório, maior que R$ 0,00.
- **Descrição (`modal.tx.input.description`):** Obrigatória (ex.: "Supermercado", "Salário").
- **Data (`modal.tx.input.date`):** Formato `YYYY-MM-DD`.
- **Forma de pagamento (`ACCOUNT` ou `CREDIT_CARD`):** Despesas podem ser vinculadas a conta bancária ou cartão de crédito (com parcelamento de 1 a 48x).
- **Status (`COMPLETED` ou `PENDING`):** Apenas lançamentos `COMPLETED` em conta afetam imediatamente o saldo consolidado.

## Pós-condições e Efeitos Colaterais
- Criar uma despesa no cartão associa automaticamente à fatura (`CreditCardInvoice`) correta conforme o dia de fechamento do cartão.
- Excluir um lançamento reverte imediatamente seu impacto no saldo da conta ou fatura.
