---
docId: errors-limits-and-recovery
module: system
version: 1.2.0
screens: ["overview", "transactions", "goals", "accounts", "ai", "modal:SETTINGS"]
relatedTools: ["navigate_to_section", "guide_feature_workflow"]
tags: ["erro", "validacao", "recuperacao", "limite", "falha", "api", "chave", "duplicado"]
---

# Mensagens de Erro, Validações e Estratégias de Recuperação

## Validações Comuns de Formulários
- **Valor inválido ou zerado:** Todo valor monetário deve ser maior que `R$ 0,00`. Aceita formato brasileiro (`1.500,50` ou `1500,50`).
- **Transferência para mesma conta:** Conta de origem e destino devem ser distintas. Caso o usuário tenha apenas uma conta ativa, oriente a criar uma segunda conta em **Contas & Cartões**.
- **Dia de fechamento/vencimento:** Deve estar entre `1` e `31`. **Ciclo mensal:** entre `1` e `28`. Para dias úteis em regras estáticas, o limite é `1` a `23`.
- **Ano de meta ou feriado:** Deve estar entre `2000` e `2100`.

## Erros de Provedor de IA e Recuperação
- **Chave ausente ou HTTP 401/403:** Orientar o usuário a ir em **Copiloto IA & Extrato** -> **Conector de Provedores**, verificar a chave de API e rodar o **Sanity Check**.
- **Erro HTTP 429 (Cota excedida) ou 504 (Timeout):** Informar claramente a causa sem inventar resultados; sugerir trocar de modelo no seletor do cabeçalho ou aguardar recarga de cota.
- **Falha de sincronização de feriados online (BrasilAPI offline):** O serviço faz fallback automático para feriados fixos e estaduais embutidos, permitindo também cadastro manual.

## Recuperação de Execução do Agente
- Se o usuário interromper uma ação (`Esc` ou clique fora), nenhuma alteração não confirmada é salva.
- Se uma mutação apresentar erro de banco ou validação, o agente reporta o erro real sem declarar sucesso fictício.
- **Lote parcial:** em um lote (várias ações num único cartão), as etapas que deram certo ficam salvas mesmo que outra falhe. O resultado mostra `✓`/`✗` por etapa e o botão **Desfazer** reverte as etapas concluídas.
- Ações concluídas do agente podem ser revertidas pelo botão **Desfazer** usando o snapshot `beforeStateJson` da auditoria. Criações são removidas; edições são restauradas; **exclusões são recriadas** (mesmos dados, novo identificador interno). Se o item já tiver sido usado depois (por exemplo, uma conta que já recebeu lançamentos), o desfazer pode ser recusado com uma explicação.
- Se o agente não encontrar a conta, cartão, categoria, meta ou lançamento citado, ou achar mais de um candidato, ele **não prepara nada** e mostra a mensagem com as opções encontradas para você especificar.
- **Sem chave de API (modo local):** o agente só navega, guia, captura telas, aplica filtros, altera preferências, cria metas simples e faz análises locais. Para criar ou editar lançamentos, regras, orçamentos, contas e cartões, conecte um provedor em **Copiloto IA & Extrato → Conector de Provedores**.
