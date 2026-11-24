# Especificação de Requisitos - Sistema de Gestão Financeira Pessoal

> **Versão:** 1.0.0  
> **Status:** Aprovado para Implementação  
> **Público-alvo:** Uso Pessoal Exclusivo  

---

## 1. Visão Geral do Produto

O sistema é uma aplicação web moderna, responsiva e focada em usabilidade (mobile-first), concebida para fornecer controle financeiro rigoroso, previsibilidade orçamentária e acompanhamento em tempo real da saúde financeira do usuário.

A aplicação adota o modelo de **Uso Pessoal Exclusivo**, garantindo privacidade absoluta dos dados, segurança através de autenticação forte e operação contínua com **Custo Zero ($0/mês)** e **alta persistência** (sem riscos de suspensão ou perda de dados após 30 ou 60 dias).

---

## 2. Requisitos Não Funcionais (RNF)

| Identificador | Categoria | Descrição |
| :--- | :--- | :--- |
| **RNF-01** | **Custo Operacional** | A infraestrutura completa de hospedagem, banco de dados e armazenamento deve operar com \$0/mês sem expiração de período de testes. |
| **RNF-02** | **Persistência e Confiabilidade** | O banco de dados (LibSQL / Turso) não deve suspender, hibernar ou expirar dados por inatividade prolongada. |
| **RNF-03** | **Segurança e Acesso** | Acesso restrito a um único usuário administrador via autenticação segura (NextAuth / JWT com hash bcrypt). Proibido auto-cadastro público. |
| **RNF-04** | **Responsividade (Mobile-First)** | A interface deve ser 100% responsiva, adaptada para telas de smartphones (360px+) com navegação rápida para lançamentos em trânsito. |
| **RNF-05** | **Performance e Latência** | Carregamento inicial do dashboard em menos de 1.5s em conexões 4G/banda larga. Queries de agregação otimizadas com índices. |
| **RNF-06** | **Integridade Financeira** | Valores monetários armazenados em centavos (inteiros no banco) ou Decimal/BigInt para evitar erros de ponto flutuante do JavaScript (IEEE 754). |
| **RNF-07** | **Stack Tecnológica** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide Icons, Prisma ORM e LibSQL / Turso. |
| **RNF-08** | **Design System & Rigor Visual** | Aderência integral ao [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md): grid base de 4px/8px, números tabulares (`tabular-nums`), modais com suporte a drawer no mobile, tokens semânticos e zero flicker de tema. |

---

## 3. Requisitos Funcionais (RF)

### 3.1. Gestão de Contas e Meios de Pagamento
* **RF-01 (Contas Bancárias e Carteiras):** O sistema deve permitir criar, editar, arquivar e visualizar contas correntes, contas de poupança e carteiras de dinheiro físico.
* **RF-02 (Saldo Inicial e Atual):** Cada conta deve registrar um saldo inicial e refletir o saldo consolidado atual com base nas transações efetivadas.
* **RF-03 (Cartões de Crédito):** O sistema deve permitir o cadastro de cartões de crédito contendo:
  * Nome do cartão e bandeira.
  * Limite total de crédito.
  * Dia de fechamento da fatura (corte).
  * Dia de vencimento da fatura.
  * Cor de identificação visual.
* **RF-04 (Cálculo de Limite do Cartão):** O sistema deve calcular automaticamente o limite disponível subtraindo as parcelas e compras pendentes nas faturas abertas e futuras.

---

### 3.2. Gestão de Transações
* **RF-05 (Tipos de Transação):** O sistema deve suportar 3 tipos essenciais:
  1. `RECEITA` (Income): Entrada financeira vinculada a uma conta.
  2. `DESPESA` (Expense): Saída financeira de uma conta corrente/dinheiro OU lançamento na fatura de um cartão de crédito.
  3. `TRANSFERÊNCIA` (Transfer): Movimentação entre duas contas próprias (débito na origem e crédito no destino).
* **RF-06 (Categorias e Subcategorias):** O sistema deve permitir categorizar transações com ícones e cores (ex: Moradia > Aluguel, Alimentação > Supermercado, Transporte > Combustível).
* **RF-07 (Tags Personalizadas):** O usuário deve poder adicionar tags arbitrárias aos lançamentos (ex: `#viagem-rio`, `#trabalho`, `#reforma`) para filtros cruzados.
* **RF-08 (Status do Lançamento):** O lançamento pode estar com status `EFETIVADO` (já debitado/creditado) ou `PENDENTE` (previsto para data futura).

---

### 3.3. Compras Parceladas no Cartão de Crédito
* **RF-09 (Parcelamento Automático):** Ao lançar uma despesa no cartão de crédito com $N$ parcelas (ex: 10x de R$ 150,00):
  * O sistema deve calcular automaticamente a fatura inicial com base na data da compra e no dia de fechamento do cartão.
  * O sistema deve gerar as $N$ parcelas individuais (1/10, 2/10, ..., 10/10) nas respectivas faturas dos meses subsequentes.
  * O valor total da compra deve impactar o limite do cartão imediatamente.
* **RF-10 (Edição de Parcelas):** Permitir ao usuário antecipar parcelas ou excluir a série inteira com aviso prévio.

---

### 3.4. Transações Recorrentes e Fixas
* **RF-11 (Lançamentos Fixos/Recorrentes):** O sistema deve permitir cadastrar despesas e receitas que se repetem com periodicidade (mensal, quinzenal, semanal ou anual).
  * Exemplo: Salário (mensal dia 05), Aluguel (mensal dia 10), Spotify (mensal dia 22).
* **RF-12 (Projeção no Fluxo de Caixa):** Os lançamentos fixos ativos devem ser projetados no fluxo de caixa dos meses futuros, permitindo prever o saldo estimado no final do mês.

---

### 3.5. Metas e Orçamentos (Budgets)
* **RF-13 (Orçamento Mensal por Categoria):** O usuário pode definir um teto máximo de gastos para cada categoria no mês (ex: Lazer: R$ 600,00/mês).
* **RF-14 (Acompanhamento e Alertas Visuais):** O sistema deve exibir barras de progresso indicando o percentual consumido do orçamento:
  * Verde: 0% a 70%.
  * Amarelo (Atenção): 71% a 90%.
  * Vermelho (Crítico/Estourado): 91% a 100%+.

---

### 3.6. Anexo de Comprovantes e Recibos
* **RF-15 (Upload de Comprovante):** Permitir anexar imagem (JPEG, PNG, WebP) ou documento (PDF) a qualquer transação (recibo, nota fiscal, comprovante Pix).
* **RF-16 (Visualização e Download):** O usuário deve poder visualizar ou baixar o comprovante diretamente pelo modal/detalhes da transação.

---

### 3.7. Dashboard e Relatórios
* **RF-17 (Visão Geral - Dashboard):**
  * Saldo Total Consolidado (soma das contas ativas).
  * Total de Receitas do Mês Atual.
  * Total de Despesas do Mês Atual (contas + cartões).
  * Faturas dos Cartões do Mês (valor atual, data de fechamento e vencimento).
  * Balanço Líquido do Mês (Receitas - Despesas).
* **RF-18 (Gráficos e Indicadores):**
  * Gráfico de rosca/pizza de Despesas por Categoria no mês.
  * Gráfico de barras com histórico comparativo dos últimos 6 meses (Receitas vs Despesas).
  * Lista rápida das próximas contas a vencer nos próximos 7 a 15 dias.
* **RF-19 (Extrato e Filtros Avançados):**
  * Busca por texto na descrição.
  * Filtro por período (mês/ano ou intervalo de datas personalizado).
  * Filtro por Conta / Cartão de Crédito.
  * Filtro por Categoria ou Tag.
  * Filtro por Tipo (`Receita`, `Despesa`, `Transferência`).

---

### 3.8. Metas de Carteira e Patrimônio (Savings Goals)
* **RF-20 (Definição de Meta Patrimonial):** O usuário deve poder definir metas de saldo acumulado para meses/anos específicos (ex: *"Ter R$ 7.000,00 de saldo consolidado até Dezembro/2026"*).
* **RF-21 (Indicador de Distância e Proximidade):** O sistema deve calcular e exibir dinamicamente:
  * Valor atual acumulado vs Valor alvo da meta.
  * Percentual concluído (% atingido).
  * Distância financeira restante (quanto falta em R$ para atingir a meta).
  * Ritmo de aporte necessário (quantos reais por mês precisam ser poupados até a data-alvo).

---

### 3.9. Custos Estáticos e Ganhos Estáticos (Linha de Base Financeira)
* **RF-22 (Classificação de Natureza Financeira):** Transações e categorias devem permitir a sinalização entre:
  * `ESTÁTICO / INFLEXÍVEL`: Despesas obrigatórias que não podem ser cortadas facilmente (aluguel, condomínio, luz básica, financiamento) e receitas garantidas (salário líquido contratual).
  * `VARIÁVEL / DISCRICIONÁRIO`: Gastos flexíveis (lazer, compras, delivery) e receitas pontuais (freelancers, bônus, rendimentos).
* **RF-23 (Cálculo da Renda Livre / Margem de Segurança):** O sistema deve computar e exibir em destaque:
  $$\text{Renda Livre} = \text{Ganhos Estáticos} - \text{Custos Estáticos}$$
  Mostrando com clareza o valor líquido exato disponível para aportes na meta ou gastos variáveis sem comprometer a sobrevivência financeira.

---

### 3.10. Comparativo Mensal (MoM) e Itens de Maior Impacto
* **RF-24 (Comparação Entre Meses - Month-over-Month):** O usuário deve poder comparar dois meses (ex: Setembro vs Outubro):
  * Total de receitas do Mês A vs Mês B.
  * Total de despesas do Mês A vs Mês B com variação nominal (R$) e percentual (%).
  * Variação por categoria (ex: Alimentação subiu 15%, Transporte caiu 10%).
* **RF-25 (Destaque do Item/Categoria Campeã):** Identificar e destacar automaticamente em cada mês e no comparativo:
  * A **categoria campeã de gastos** (onde mais dinheiro foi consumido).
  * O **item/transação individual de maior valor** registrado no período.

---

### 3.11. Configurações e Preferências Persistidas no Banco de Dados
* **RF-26 (Persistência de Preferências do Usuário):** O sistema deve persistir todas as configurações de visualização e regras de negócio do usuário na tabela `USER_SETTINGS` no banco de dados, incluindo:
  * **Tema da Aplicação:** Modo Escuro (`DARK`), Modo Claro (`LIGHT`) ou Automático do Sistema (`SYSTEM`).
  * **Modo Privacidade:** Opção para ocultar valores numéricos com máscara (`R$ ••••••`) com toggle rápido persistido.
  * **Densidade Visual:** Espaçamento compacto ou confortável para tabelas e extratos.
  * **Dia Inicial do Mês Financeiro:** Customização do dia em que o ciclo mensal se reinicia (ex: dia 1 ou dia 5).
  * **Conta Padrão:** Pré-seleção da conta financeira favorita ao abrir o modal de nova transação.

---

### 3.12. Inteligência Artificial: Conexão Multi-Provedor (Assinatura & Cota API) e Leitura de Extrato
* **RF-27 (Hub de Conexão com ChatGPT, Gemini e Claude):** O sistema deve permitir configurar e alternar entre os 3 grandes provedores de IA (**OpenAI ChatGPT**, **Google Gemini** e **Anthropic Claude**) operando em duas modalidades complementares salvas no banco (`USER_SETTINGS`):
  1. **Modo Plano de Assinatura (ChatGPT Plus / Gemini Advanced / Claude Pro):** Geração automática de prompt estruturado com contexto financeiro e esquema JSON, abertura rápida do chat oficial onde o usuário está logado com sua assinatura e importação direta da resposta gerada sem consumir créditos de API.
  2. **Modo Cota de API Direta (OpenAI API / Google AI Studio / Anthropic API / Endpoint Customizado):** Execução direta via backend com chave de API configurável pelo usuário e persistida no banco.
* **RF-28 (Leitura de Extrato e Cadastro Automático em Lote):** A IA deve analisar textos de extratos bancários, faturas de cartão, arquivos CSV/TXT ou relatos em linguagem natural (ex: *"Recebi 5500 de salário, gastei 180 em peças e 95 no mercado"*), identificar automaticamente cada item que o usuário **ganhou (`INCOME`)** e **gastou (`EXPENSE`)**, classificar como `ESTÁTICO` ou `VARIÁVEL`, mapear para a categoria correspondente e permitir cadastrar todos os itens no banco após revisão.
* **RF-29 (Análise Inteligente de Status Financeiro):** A IA deve analisar o status financeiro atual do usuário (Saldo Consolidado, Meta de Carteira, Custos Estáticos vs Ganhos Estáticos e Comparativo Mensal MoM) e gerar um diagnóstico estruturado com pontos fortes, riscos e plano de ação prático para atingir a meta de carteira.

---

## 4. Regras de Negócio Críticas (RN)

* **RN-01 (Fechamento de Cartão de Crédito):** 
  * Se a compra for realizada **antes** do dia de fechamento, a 1ª parcela incide na fatura do mês atual.
  * Se a compra for realizada **no dia de fechamento ou após**, a 1ª parcela incide na fatura do mês seguinte ("melhor dia de compra").
* **RN-02 (Pagamento de Fatura):**
  * O pagamento de uma fatura de cartão deve gerar um débito na conta bancária de origem e marcar a fatura como `PAGA`.
  * O limite do cartão é restabelecido no valor pago.
* **RN-03 (Integridade de Exclusão):**
  * Não é permitido excluir uma conta bancária que contenha transações ativas vinculadas, a menos que o usuário opte por arquivar a conta ou transferir os lançamentos.
* **RN-04 (Imutabilidade de Valores Falsos):**
  * O saldo de uma conta bancária nunca é atualizado via input manual aleatório; ele é sempre o resultado estrito da fórmula:  
    $$\text{Saldo Atual} = \text{Saldo Inicial} + \sum \text{Receitas Efetivadas} - \sum \text{Despesas Efetivadas} \pm \sum \text{Transferências}$$
* **RN-05 (Comprometimento da Renda Estática):**
  * Se os `Custos Estáticos` superarem os `Ganhos Estáticos`, o sistema deve emitir um alerta vermelho imediato no painel: *"Atenção: Seus custos fixos ultrapassam sua renda garantida em R$ X"*.
* **RN-06 (Cálculo de Proximidade da Meta de Carteira):**
  * O saldo considerado para a meta de carteira é a soma do saldo disponível em todas as contas ativas menos as faturas de cartão de crédito em aberto/fechadas a pagar.
