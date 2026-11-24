---
docId: ai-copilot-and-reconciliation
module: ai
version: 1.1.0
screens: ["ai", "modal:SANITY_CHECK"]
relatedTools: ["navigate_to_section", "generate_financial_report", "guide_feature_workflow", "capture_annotated_screen"]
tags: ["ia", "copiloto", "provedor", "openai", "gemini", "claude", "api key", "chave", "modelo", "extrato", "conciliacao", "diagnostico", "relatorio"]
---

# Copiloto IA, Conciliação de Extratos e Diagnósticos

## Onde encontrar
- Aba **Copiloto IA & Extrato** (`nav.tab.ai`).
- **Chatbot Flutuante (Agente IA):** Disponível globalmente no canto inferior direito em todas as abas (`agent.btn.toggleChat`).

## Módulos da Aba Copiloto IA
1. **Conector de Provedores IA (`ai.panel.providers`):** Autenticação exclusiva por **Chave de API (API Key)** para OpenAI, Google Gemini e Anthropic Claude, com descoberta dinâmica real dos modelos diretamente nos endpoints oficiais (**Atualizar**), seleção global de modelo (`header.model.selector`) e teste real no **Console Sanity Check**. Chaves são criptografadas com AES-256-GCM e nunca retornam em claro.
2. **Importação & Conciliação Inteligente de Extratos (`ai.panel.reconciliation`):**
   - Suporta upload múltiplo de **CSV, OFX, XLSX, PDF e TXT** ou colar texto.
   - Etapas: 1) Envio -> 2) Revisão Humana & Classificação Semântica (com memória de aprendizado) -> 3) Commit Atômico no Banco -> 4) Histórico com detecção de duplicados, paginação e reversão controlada.
3. **Diagnóstico de Status Financeiro & Plano de Ação IA (`ai.panel.healthReports`):**
   - Botão **Gerar Diagnóstico Agora** (`ai.btn.generateHealth`) gera e salva pareceres com nota de saúde financeira (0–100), pontos fortes, riscos e plano de ação.
   - Possui busca por texto, filtro por **data inicial e final**, faixa de nota (`Saudável`, `Atenção`, `Crítico`), provedor, ordenação e paginação (4 por página).
