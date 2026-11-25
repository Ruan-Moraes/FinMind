---
docId: transactions-and-ledger
module: transactions
version: 1.3.0
screens: ["transactions", "modal:TX"]
relatedTools: ["navigate_to_section", "apply_transaction_filters", "query_expenses_and_transactions", "create_transaction", "guide_feature_workflow", "capture_annotated_screen", "update_transaction", "delete_transaction", "query_categories", "categorize_transactions"]
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
- **Categoria** (`transactions.filter.category`): filtra por qualquer categoria cadastrada. O agente também aplica este filtro (`apply_transaction_filters` com `categoryName`).

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

## O que o Agente IA pode fazer aqui
- **Criar** lançamento (`create_transaction`): receita, despesa, **transferência** (conta de origem + destino), despesa em **cartão** (com `installments` de 1 a 48) e `status` PENDING/COMPLETED. Se a conta, o cartão ou a categoria citados **não existirem** (ou forem ambíguos), o agente recusa e lista as opções; nunca grava em outra conta por aproximação.
- **Editar** (`update_transaction`) e **excluir** (`delete_transaction`) um lançamento localizado por ID ou por descrição (+ data/valor), em todo o histórico. Compras parceladas não são editadas pelo agente; para editar parcelas use a tela de Extrato. Na exclusão, o padrão remove **somente a parcela indicada** (o cartão de confirmação avisa); para remover a compra inteira, peça "todas as parcelas" (`deleteInstallmentSeries`). Ao desfazer, a parcela volta para a mesma compra parcelada.
- Sem categoria informada, o lançamento usa a categoria sugerida pelas regras aprendidas (memória de conciliação) ou fica **sem categoria** — o agente não escolhe uma categoria arbitrária.
- **Classificar em lote** (`categorize_transactions`): por trecho da descrição, IDs ou mês (no ciclo mensal do usuário). Só aplica a lançamentos do mesmo tipo da categoria (despesa ↔ categoria de gasto, receita ↔ categoria de ganho); transferências nunca recebem categoria. Se a categoria não existir, o cartão avisa que ela será criada. Por padrão a classificação é **memorizada** para as próximas importações de extrato; ao desfazer, a memória e a categoria criada também são revertidas.
