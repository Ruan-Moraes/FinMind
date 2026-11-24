---
docId: settings-holidays-and-backup
module: settings
version: 1.1.0
screens: ["modal:SETTINGS", "modal:HOLIDAYS", "modal:RESET"]
relatedTools: ["open_settings", "update_user_preferences", "guide_feature_workflow", "capture_annotated_screen"]
tags: ["configuracoes", "preferencias", "estado", "cidade", "feriados", "dias uteis", "ciclo mensal", "backup", "snapshot", "exportar", "reset"]
---

# Configurações, Feriados, Exportação e Backup

## Onde encontrar
- Botão de engrenagem no cabeçalho: **Abrir Configurações** (`header.btn.settings`) abre o modal **Configurações & Preferências** (`modal:SETTINGS`).

## Preferências Configuráveis (`modal:SETTINGS`)
- **Aparência da Interface:** Modo Escuro, Modo Claro ou Sistema.
- **Conta Padrão para Lançar** (`defaultAccountId`), **Densidade de Tabelas** (`COMFORTABLE` / `COMPACT`) e **Início do Ciclo Mensal** (`fiscalMonthStartDay`, 1 a 31).
- **Modo Privacidade:** Iniciar com valores ocultos.
- **Localização & Calendário de Feriados (Dias Úteis):**
  - Seletor pesquisável de **Estado (UF)** (`modal.settings.select.state`) e campo **Cidade** (`modal.settings.input.city`).
  - Botão **Calendário de Feriados** (`modal.settings.btn.holidays`) abre o gerenciador completo para sincronizar feriados nacionais (BrasilAPI 2026–2028) + estaduais (27 UFs), buscar feriados municipais com IA ou cadastrar/ativar/excluir feriados manualmente.
- **Exportação & Snapshot Completo:** Exportação CSV/JSON de transações (`/api/export`) e Snapshot completo pareado (`/api/snapshot`) para backup e restauração.
- **Zona de Perigo (Limpar / Resetar):** Ação protegida por dupla confirmação exigindo o nome completo do usuário. **Bloqueada para execução autônoma pela IA.**
