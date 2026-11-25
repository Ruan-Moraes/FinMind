# Inteligência Artificial, RAG, Embeddings e Processamento de Dados — FinMind

> Este documento explica em detalhe **onde a IA é utilizada**, **como os dados financeiros são processados**, **como os embeddings são gerados e salvos no banco** e **como o assistente responde sem alucinar valores**.

---

## 1. Onde a IA Atua na Aplicação

A IA atua em **5 fluxos independentes**, todos com fallback seguro caso não haja chave externa configurada:

```mermaid
flowchart TD
  User["Usuário no FinMind"]

  subgraph F1["1. Agente IA no Chat Flutuante (Todas as Abas)"]
    ChatUI["FloatingAiChatbot + Histórico Persistido"]
    Orch["agent-orchestrator.ts → agent-react-loop.ts"]
    Tools["Ferramentas reais (leitura, UI e mutações com confirmação)"]
    ChatUI --> Orch --> Tools
  end

  subgraph F2["2. Conciliação de Extratos Bancários"]
    Upload["Upload CSV / OFX / XLSX / PDF / TXT ou Colar Texto"]
    Parsers["Parsers Multi-Formato (src/features/reconciliation/parsers/)"]
    RecPipe["ReconciliationPipeline + Memória de Aprendizado"]
    Upload --> Parsers --> RecPipe
  end

  subgraph F3["3. Descoberta Dinâmica & Governança de Modelos"]
    ModApi["/api/ai/models (OpenAI, Gemini, Anthropic)"]
    Sanity["/api/ai/sanity-check (Teste Real + Diagnóstico)"]
  end

  subgraph F4["4. Diagnóstico de Saúde Financeira"]
    Health["FinancialHealthReportsPanel + AiAnalysisReport"]
  end

  subgraph F5["5. Entrada por Voz"]
    Voice["/api/ai/transcribe (Whisper / Gemini) + refineVoiceTranscriptAction"]
  end

  User --> F1
  User --> F2
  User --> F3
  User --> F4
  User --> F5
```

> O antigo "assistente RAG" (`assistant-orchestrator.ts`, `sendAiChatMessageAction`, síntese determinística e gráficos montados no servidor) foi **removido** e substituído pelo Agente IA (seção 6). Restam apenas os tipos `AssistantStructuredResponse`/`AssistantChartSpec`, usados para reabrir conversas antigas do histórico.

---

## 2. Pipeline de Embeddings & Salvamento no Banco (RAG)

O sistema mantém uma tabela dedicada no banco de dados: **`FinancialKnowledgeChunk`** (`prisma/schema.prisma`), estritamente isolada por `userId`.

### O que é indexado?
Em `src/features/ai-copilot/rag/knowledge-builder.ts`, o FinMind converte os registros reais do usuário em documentos textuais ricos em contexto financeiro:
- **Lançamentos (`TRANSACTION`)** — até os 800 mais recentes (descrição, valor em BRL, categoria, conta/cartão, contraparte, finalidade, natureza fixa/variável e data).
- **Regras Fixas (`RECURRENCE_RULE`)** — ganhos e custos estáticos mensais ativos.
- **Metas de Carteira (`PORTFOLIO_GOAL`)** — valor alvo, prazo e observações.
- **Orçamentos (`BUDGET`)** — teto mensal por categoria.

### Como os Embeddings são gerados e salvos?

```mermaid
sequenceDiagram
  autonumber
  participant Sync as knowledge-sync.ts
  participant Builder as knowledge-builder.ts
  participant Gateway as embedding-gateway.ts
  participant Ext as OpenAI / Google API
  participant Local as Vetorizador Local 64D
  participant DB as FinancialKnowledgeChunk (SQLite / libSQL)

  Sync->>DB: Carrega transactions, rules, goals, budgets e chunks existentes (WHERE userId = ?)
  Sync->>Builder: Gera documentos candidatos + SHA-256 (contentHash)
  Sync->>DB: Remove chunks obsoletos (itens excluídos ou revertidos)
  Note over Sync: Filtra apenas documentos NOVOS ou cujo contentHash mudou (evita re-embedar o que não mudou)

  loop Em lotes de até 64 documentos
    Sync->>Gateway: generateEmbeddingsBatch(texts, userKeys)
    alt Chave OpenAI configurada
      Gateway->>Ext: POST /v1/embeddings (text-embedding-3-small)
      Ext-->>Gateway: Vetores 1536D
    else Chave Gemini configurada
      Gateway->>Ext: POST models/text-embedding-004:batchEmbedContents
      Ext-->>Gateway: Vetores 768D
    else Sem chave externa / Erro de rede
      Gateway->>Local: computeDeterministicFinancialEmbedding(text)
      Local-->>Gateway: Vetor normalizado L2 de 64 dimensões (financial-semantic-v1)
    end
    Gateway-->>Sync: { vectors, model }
    Sync->>DB: prisma.$transaction(upsert por [userId, sourceType, sourceId])
    Note over DB: Grava contentText, contentHash, embeddingJson (JSON do vetor) e embeddingModel
  end
```

### Detalhe do Vetorizador Local Determinístico (`financial-semantic-v1` — 64 dimensões)
Quando o usuário usa Claude (que não possui endpoint de embeddings) ou opera sem chave de API externa, `rag-math-and-security.ts` gera um vetor L2-normalizado de 64 floats:
- **Dimensões `0..20`:** taxonomia de finalidade financeira (`HOUSING_RENT`, `SALARY_COMPENSATION`, `GROCERY_SUPERMARKET`, `EDUCATION`, `SUBSCRIPTION_STREAMING`, etc.).
- **Dimensões `21..25`:** direção e natureza (receita, despesa, transferência, estático, variável).
- **Dimensões `26..31`:** entidades de planejamento (meta, orçamento, cartão/fatura, meio de pagamento).
- **Dimensões `32..63`:** feature hashing de tokens significativos (ignorando stopwords em português).

---

## 3. Como o Agente Responde (Turno do Chat)

Quando o usuário envia uma mensagem no **Chat Flutuante** (`planAgentTurnAction` → `runAgentPlanningTurn`):

```mermaid
flowchart TD
  Q["Mensagem + Estado da UI (aba, período, modal)"]
  Guard["Guarda de Segurança (reset geral, senha, chaves de API → BLOCKED)"]
  Ctx["Contexto: top-5 trechos da Base de Conhecimento do sistema + 8 últimas mensagens da sessão"]
  LLM{"Chave + modelo selecionados?"}
  Loop["Loop ReAct (até 4 rodadas): o modelo chama ferramentas"]
  Read["Leitura (query_*, compare_*, search_financial_history...) → dados reais do banco"]
  Prep["Mutações → preparePreview (nada é gravado): retorna 'prepared' ou o erro real ao modelo"]
  Render["render_visual_content → gráficos/tabelas com valores das consultas"]
  Valid["Validador de intenção (1 retry de correção)"]
  Local["Motor local: regras determinísticas (navegação, guias, filtros, preferências, criar meta) + análise local"]
  Card["Cartão de confirmação Antes → Depois (AgentActionAuditLog = AWAITING_CONFIRMATION)"]
  Save["Persiste mensagem + payload em AiChatMessage"]

  Q --> Guard --> Ctx --> LLM
  LLM -- "Sim" --> Loop
  Loop --> Read --> Loop
  Loop --> Prep --> Loop
  Loop --> Render --> Valid
  LLM -- "Não ou erro do provedor" --> Local
  Valid --> Card --> Save
  Local --> Save
```

### Garantias de Precisão e Confiabilidade
1. **Isolamento Multi-Tenant:** toda leitura e escrita filtra por `userId`; a busca semântica (`FinancialKnowledgeChunk`) também.
2. **Números reais:** o modelo só monta gráficos via `render_visual_content` depois de consultar ferramentas de leitura; o validador força uma correção quando isso não acontece.
3. **Nada é salvo sem confirmação:** mutações L2/L3 geram apenas um plano. Recusas de preparo (nome inexistente/ambíguo, duplicidade, campos faltando) voltam ao modelo como resultado da ferramenta e **sempre** aparecem na resposta ao usuário.
4. **Edição parcial:** nas edições, campos que o usuário não citou são mantidos (dia da regra fixa, cartão vinculado, bandeira do cartão, tipo da conta, prazo da meta etc.).
5. **Histórico Persistido:** cada conversa grava uma `AiChatSession` e todas as mensagens (`AiChatMessage`), incluindo o payload completo do turno.

### Sem chave de API
Sem provedor conectado, o agente funciona em **modo local**: responde saudações, navega, abre guias e capturas, aplica filtros, altera preferências, cria metas de carteira simples e faz análises locais com os dados reais. **Criar/editar lançamentos, regras, orçamentos, contas, cartões e demais alterações exige um provedor de IA conectado.**

---

## 4. Pipeline de Processamento de Extratos Bancários

```mermaid
flowchart LR
  Files["Arquivos: CSV, OFX, XLSX, PDF, TXT<br/>ou Texto Colado"]
  Detect["Detecção de Banco & Formato<br/>(statement-detectors.ts)"]
  Parse["Extração Estruturada<br/>(unpdf / xlsx / csv / ofx)"]
  Norm["Normalização de Datas, Centavos<br/>e Hash Externo (Deduplicação)"]
  Sem["Classificação Semântica +<br/>Memória Aprendida (ReconciliationMemoryRule)"]
  Match["Conciliação com Regras Fixas<br/>e Lançamentos Existentes"]
  Review["Tela de Revisão Humana<br/>(Edição, Filtros e Calibração de Saldo)"]
  Commit["Commit Atômico em prisma.$transaction<br/>(StatementImportBatch + Transactions)"]
  Audit["Histórico com Detecção de Duplicados,<br/>Paginação e Reversão Controlada"]

  Files --> Detect --> Parse --> Norm --> Sem --> Match --> Review --> Commit --> Audit
```

---

## 5. Descoberta Dinâmica de Modelos de IA

A rota `/api/ai/models` consulta ao vivo os modelos liberados para a chave do usuário nos 3 provedores:
- **OpenAI:** `GET https://api.openai.com/v1/models` (filtra modelos de chat/raciocínio `gpt-*`, `o1*`, `o3*`, `o4*`, `chatgpt-*` e exclui áudio/embedding/imagem).
- **Google Gemini:** `GET https://generativelanguage.googleapis.com/v1beta/models` (filtra modelos com suporte a `generateContent`).
- **Anthropic Claude:** `GET https://api.anthropic.com/v1/models` (lista modelos Claude ativos na conta).

Qualquer novo modelo descoberto dinamicamente é resolvido automaticamente em `models-catalog.ts` sem precisar atualizar código estático.

---

## 6. Agente IA Autônomo, Visual e Contextual (`src/features/ai-agent/`)

O FinMind evoluiu o assistente para um **Agente Autônomo Interativo** integrado à interface, com separação em 6 camadas:

1. **Base de Conhecimento Versionada (`docs/knowledge/*.md`) + RAG Dual:**
   - Documentos modulares em Markdown (telas, fluxos, regras de negócio, validações e erros) indexados por SHA-256 nas tabelas `SystemKnowledgeDocument` e `SystemKnowledgeChunk` (`pnpm kb:validate` / `pnpm kb:sync`).
   - Busca híbrida (cosseno sobre o vetor local `financial-semantic-v1` + proporção de termos da pergunta presentes no trecho + boost pela aba ativa). Os 5 melhores trechos entram no prompt como conteúdo não confiável.
   - A base é sincronizada automaticamente quando o hash dos arquivos em disco difere do banco.
   - O histórico financeiro do usuário (`FinancialKnowledgeChunk`) **não** entra automaticamente no prompt: o agente o consulta sob demanda com a ferramenta `search_financial_history`.
2. **Percepção da Interface (`UiStateSnapshot`) & Registro Semântico (`data-agent-id`):**
   - Cada turno envia aba ativa, período, modal aberto, filtros, tema e alvos montados no DOM (`agent-target-registry.ts`), sem depender de coordenadas fixas ou seletores frágeis.
3. **Tool Calling Multi-Provedor (`agent-tool-provider-client.ts`):**
   - Suporte nativo a chamadas de ferramentas em **OpenAI**, **Google Gemini** e **Anthropic Claude**, com roteamento determinístico seguro de fallback.
4. **Interação Visual Interrompível (`AgentVisualStage`):**
   - Cursor virtual com trajetória curva Bézier (`AiVirtualCursor`), destaque luminoso contextual (`AiElementSpotlight`), rolagem suave e pílula de controle (`Pausar` / `Parar Esc` + interrupção automática ao clicar fora).
   - 3 modos selecionáveis no cabeçalho do chat: **Visual** (padrão), **Guiado** (ensina sem salvar) e **Rápido**.
5. **Captura Real e Anotação de Telas (`modern-screenshot` + `CanvasAnnotator`):**
   - Captura o estado real renderizado da interface (tema, dados e modais atuais), oculta automaticamente elementos sensíveis (`data-agent-sensitive`) ou respeita o Modo Privacidade, e desenha caixas de destaque e etapas numeradas exibidas inline no chat com zoom.
6. **Governança, Confirmação Prévia, Verificação e Rollback (`AgentActionAuditLog`):**
   - Matriz de risco `L0`/`L1` (imediato), `L2`/`L3` (confirmação prévia com diff *Antes → Depois*, trava contra clique duplo, verificação real no banco pós-persistência e botão **Desfazer**) e `BLOCKED` (Reset Geral e credenciais bloqueados para execução autônoma).
   - Estados: `AWAITING_CONFIRMATION → EXECUTING → SUCCEEDED | FAILED`, e `SUCCEEDED → ROLLING_BACK → ROLLED_BACK`. Um lote com etapas falhas que gravou parte das ações fica `SUCCEEDED` (com a falha anotada), para que o **Desfazer** reverta o que foi salvo.
   - Ferramenta desconhecida citada pelo modelo é ignorada (com aviso) sem derrubar as demais ações do turno.
