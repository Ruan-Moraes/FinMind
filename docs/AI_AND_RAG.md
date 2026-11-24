# Inteligência Artificial, RAG, Embeddings e Processamento de Dados — FinMind

> Este documento explica em detalhe **onde a IA é utilizada**, **como os dados financeiros são processados**, **como os embeddings são gerados e salvos no banco** e **como o assistente responde sem alucinar valores**.

---

## 1. Onde a IA Atua na Aplicação

A IA atua em **4 fluxos independentes**, todos com fallback seguro caso não haja chave externa configurada:

```mermaid
flowchart TD
  User["Usuário no FinMind"]

  subgraph F1["1. Chatbot Flutuante (Todas as Abas)"]
    ChatUI["FloatingAiChatbot + Histórico Persistido"]
    Orch["assistant-orchestrator.ts"]
    Charts["assistant-chart-builder.ts (Gráficos Reais)"]
    ChatUI --> Orch --> Charts
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

  User --> F1
  User --> F2
  User --> F3
  User --> F4
```

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

## 3. Recuperação Híbrida, Gráficos Dinâmicos e Resposta Sem Alucinação

Quando o usuário envia uma mensagem no **Chatbot Flutuante** (`sendAiChatMessageAction` → `executeContextualFinancialAssistant`):

```mermaid
flowchart TD
  Q["Pergunta do Usuário + Sessão (AiChatSession)"]
  SaveU["Salva mensagem do usuário em AiChatMessage"]
  Sync["syncUserFinancialKnowledge() (atualiza deltas via contentHash)"]
  Retr["retrieveFinancialContextForQuery()"]
  Score["Score Híbrido por Chunk:<br/>0.55 × Cosseno Vetorial<br/>+ 0.45 × Overlap Léxico<br/>+ Boost Temporal/Intenção (Mês, Meta, Fixo, Orçamento)"]
  Sanitize["Sanitização Anti-Prompt Injection (Top 15 chunks)"]
  Det["Síntese Determinística (deterministic-synthesis.ts)<br/>Cálculos 100% exatos em centavos"]
  Charts["assistant-chart-builder.ts<br/>Gera KPIs, Donut, Barras 6m e Progresso de Metas"]
  LLM{"Chave externa ativa?<br/>(OpenAI / Gemini / Claude)"}
  LiveCall["callProviderApiJson() com prompt aterrado nos números exatos"]
  Fallback["Usa resposta estruturada determinística local"]
  SaveA["Persiste resposta + charts em AiChatMessage.responseJson"]
  Render["FloatingChatMessage renderiza texto + Recharts interativos"]

  Q --> SaveU --> Sync --> Retr --> Score --> Sanitize
  Sanitize --> Det
  Sanitize --> Charts
  Det --> LLM
  LLM -- "Sim (sucesso)" --> LiveCall --> SaveA
  LLM -- "Não ou erro HTTP/cota" --> Fallback --> SaveA
  Charts --> SaveA --> Render
```

### Garantias de Precisão e Confiabilidade
1. **Isolamento Multi-Tenant:** todas as queries RAG filtram obrigatoriamente por `where: { userId }`.
2. **Gráficos 100% Reais:** os dados dos gráficos dinâmicos (`kpi_strip`, `donut`, `bar_comparison`, `progress_bars`) são construídos diretamente no servidor por `assistant-chart-builder.ts` a partir do banco — o LLM **nunca inventa números de gráfico**.
3. **Separação Estrutural:** cada resposta separa explicitamente **Fatos Históricos**, **Cálculos Exatos**, **Projeções & Estimativas** e **Recomendações Práticas**, exibindo as fontes consultadas.
4. **Histórico Persistido:** cada nova conversa grava uma `AiChatSession` com título automático e salva todas as mensagens (`AiChatMessage`) incluindo o JSON completo da resposta e dos gráficos, permitindo reabrir e consultar depois.

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
   - Busca híbrida (cosseno vetorial + BM25 léxico + boost pela aba ativa) combinada ao `FinancialKnowledgeChunk` isolado por `userId`.
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
   - Matriz de risco `L0`/`L1` (imediato), `L2`/`L3` (confirmação prévia com diff *Antes → Depois*, idempotência, verificação real no banco pós-persistência e botão **Desfazer**) e `BLOCKED` (Reset Geral e credenciais bloqueados para execução autônoma).
