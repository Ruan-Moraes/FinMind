---
docId: system-global-rules
module: system
version: 1.2.0
screens: ["overview", "ai", "comparison", "goals", "forecast", "accounts", "transactions"]
relatedTools: ["navigate_to_section", "update_user_preferences", "capture_annotated_screen"]
tags: ["sistema", "arquitetura", "regras", "seguranca", "privacidade", "permissoes", "moeda"]
---

# Sistema FinMind — Conceitos e Regras Globais

## Visão Geral e Propósito
O FinMind é um sistema de gestão financeira pessoal focado em patrimônio consolidado, metas de carteira, controle de custos e ganhos estáticos (fixos), cartões de crédito, previsão de fluxo futuro e conciliação de extratos com apoio de IA.

## Regras Globais de Negócio
- **Valores monetários:** Todos os valores são armazenados em centavos inteiros no banco (`amountInCents`) e exibidos em Reais brasileiros (`R$ 1.234,56`).
- **Isolamento de dados:** Toda consulta, criação, edição e exclusão é restrita ao usuário autenticado (`userId`).
- **Modo Privacidade:** Quando ativado (`header.btn.privacy` ou em Configurações), todos os saldos e faturas são mascarados visualmente como `R$ ••••••`. Capturas de tela devem respeitar o Modo Privacidade.
- **Ciclo Mensal Fiscal:** Definido em Configurações (`fiscalMonthStartDay`, dia 1 a 28). É um dia fixo de calendário que recorta o mês financeiro exibido no dashboard.
- **Tema e Densidade:** Suporta Modo Escuro (`DARK`), Modo Claro (`LIGHT`) e Sistema (`SYSTEM`), além de densidade de tabelas Confortável ou Compacta.

## Políticas de Segurança e Permissões do Agente IA
- **Leitura, Navegação e Orientação (`L0` / `L1`):** Executam imediatamente sem alterar dados persistidos.
- **Criação e Edição (`L2`):** Exigem confirmação prévia apresentando resumo da alteração (*Antes -> Depois*) e verificação real no banco após salvar.
- **Exclusões (`L3`):** Exigem confirmação explícita obrigatória antes de remover qualquer registro.
- **Desfazer:** Nem toda ação pode ser desfeita com 100% de fidelidade. Criações são removidas ao desfazer; edições voltam ao estado anterior; exclusões são *recriadas* a partir de uma cópia (o registro volta com os mesmos dados e vínculos — conta, cartão, fatura, categoria, regra fixa, importação e a compra parcelada original —, mas com novo identificador interno; anexos de lançamentos não são restaurados). O Desfazer só pode ser executado uma vez por ação. Consulte `10-capacidades-e-limites-do-agente.md` para a lista do que o agente consegue fazer.
- **Ações Bloqueadas (`BLOCKED`):** Reset Geral de Dados, alteração de senha, manipulação direta de chaves de API ou encerramento forçado de sessão **nunca** são executados autonomamente pela IA; o agente apenas orienta o usuário até o local correto.
