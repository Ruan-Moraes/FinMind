'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { CreditCard as CreditCardIcon, Target, ArrowLeftRight, Plus, Settings, Eye, EyeOff, Sun, Moon, Sparkles, Calendar, CalendarClock, BarChart3, Receipt, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/button';

import { Badge } from '@/shared/ui/badge';

import { HeaderModelSelector } from '@/features/ai-copilot/components/header-model-selector';
import { MONTH_NAMES_PT } from '@/shared/lib/currency';

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';


export function WorkbenchHeader() {
  const { props, wb } = useWorkbench();
  const { ssoState, activeHeaderModelId, selectedMonth, selectedYear } = props;
  const { activeTab, setActiveTab, hideValues, theme, setIsSettingsModalOpen, updatePeriodParams, handleToggleTheme, handleTogglePrivacy, handleOpenCreateTxModal } = wb;
  return (
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
        <div className="max-w-[1520px] w-full mx-auto px-4 sm:px-8 min-h-16 py-2 flex items-center justify-between gap-3">
          {/* Coluna Esquerda: Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0 shrink-0 xl:flex-1">
            <div className="h-10 w-10 rounded-xl bg-zinc-900 dark:bg-zinc-50 flex items-center justify-center text-white dark:text-zinc-950 font-bold text-lg shadow-sm shrink-0">
              FM
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight whitespace-nowrap">
                  FinMind
                </span>
                <Badge variant="neutral" className="hidden md:inline-flex">
                  Pessoal
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 hidden 2xl:block whitespace-nowrap truncate">
                Gestão Patrimonial & Custos Estáticos
              </p>
            </div>
          </div>

          {/* Coluna Central: Seletor de Período Vigente Centralizado (Protegido contra sobreposição) */}
          <div className="hidden sm:flex items-center justify-center shrink-0">
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/90 px-3 h-10 shadow-sm shrink-0">
              <Calendar className="h-4 w-4 text-indigo-500 shrink-0 mr-1" />
              <div className="relative flex items-center">
                <select
                  aria-label="Selecionar Mês"
                  data-agent-id="header.period.month"
                  value={selectedMonth}
                  onChange={(e) => updatePeriodParams({ month: Number(e.target.value) })}
                  className="appearance-none bg-transparent text-sm font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1 pr-6"
                >
                  {MONTH_NAMES_PT.map((name, idx) => (
                    <option
                      key={name}
                      value={idx + 1}
                      className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                    >
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              </div>

              <span className="h-4 w-px bg-slate-200 dark:bg-zinc-800 mx-1" />

              <div className="relative flex items-center">
                <select
                  aria-label="Selecionar Ano"
                  data-agent-id="header.period.year"
                  value={selectedYear}
                  onChange={(e) => updatePeriodParams({ year: Number(e.target.value) })}
                  className="appearance-none bg-transparent text-sm font-semibold tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pl-1 pr-5"
                >
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                    <option
                      key={yr}
                      value={yr}
                      className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                    >
                      {yr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0.5 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              </div>
            </div>
          </div>

          {/* Coluna Direita: Seletor de Modelos IA (SSO + Sanity Check) & Ações Rápidas */}
          <div className="flex items-center justify-end gap-2 shrink-0 xl:flex-1">
            <HeaderModelSelector
              initialModelId={activeHeaderModelId}
              initialSsoAuthenticated={ssoState.authenticated}
              initialSsoSession={ssoState.session}
            />

            <Button
              variant="secondary"
              size="icon"
              data-agent-id="header.btn.privacy"
              onClick={handleTogglePrivacy}
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores (Modo Privacidade)'}
              aria-label="Alternar Modo Privacidade"
            >
              {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              data-agent-id="header.btn.theme"
              onClick={handleToggleTheme}
              title="Alternar tema Claro/Escuro (Salvo no Banco)"
              aria-label="Alternar Tema"
            >
              {theme === 'DARK' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              data-agent-id="header.btn.settings"
              onClick={() => setIsSettingsModalOpen(true)}
              title="Configurações salvas no banco"
              aria-label="Abrir Configurações"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              variant="primary"
              size="md"
              data-agent-id="header.btn.newTx"
              onClick={() => handleOpenCreateTxModal()}
              className="hidden sm:inline-flex"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Novo Lançamento</span>
            </Button>
          </div>
        </div>

        {/* Barra de Período Mobile (< 640px) — permite trocar Mês e Ano em telas pequenas */}
        <div className="sm:hidden border-t border-slate-100 dark:border-zinc-900 px-4 py-2 flex items-center justify-between gap-2 bg-slate-50/60 dark:bg-zinc-900/60">
          <span className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
            Período:
          </span>
          <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 h-8 shadow-sm">
            <select
              aria-label="Selecionar Mês Mobile"
              value={selectedMonth}
              onChange={(e) => updatePeriodParams({ month: Number(e.target.value) })}
              className="appearance-none bg-transparent text-xs font-semibold text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer pr-2"
            >
              {MONTH_NAMES_PT.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <span className="h-3.5 w-px bg-slate-200 dark:bg-zinc-800 mx-1" />
            <select
              aria-label="Selecionar Ano Mobile"
              value={selectedYear}
              onChange={(e) => updatePeriodParams({ year: Number(e.target.value) })}
              className="appearance-none bg-transparent text-xs font-semibold tabular-nums text-slate-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra de Abas Desktop */}
        <div className="max-w-[1520px] w-full mx-auto px-4 sm:px-8 hidden sm:flex items-center gap-1.5 border-t border-slate-100 dark:border-zinc-900 py-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
            { id: 'ai', label: 'Copiloto IA & Extrato', icon: Sparkles },
            { id: 'comparison', label: 'Comparativo Entre Meses', icon: ArrowLeftRight },
            { id: 'goals', label: 'Meta de Carteira & Custos Estáticos', icon: Target },
            { id: 'forecast', label: 'Previsão de Valor', icon: CalendarClock },
            { id: 'accounts', label: 'Contas & Cartões', icon: CreditCardIcon },
            { id: 'transactions', label: 'Extrato & Comprovantes', icon: Receipt },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-agent-id={`nav.tab.${tab.id}`}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap leading-none shrink-0 transition-all ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>
  );
}