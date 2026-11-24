'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { CreditCard as CreditCardIcon, Target, ArrowLeftRight, Plus, Sparkles, BarChart3, Receipt, CalendarClock } from 'lucide-react';

import type { ActiveTab } from '@/features/dashboard/types/workbench-types';


export function WorkbenchMobileBottomNav() {
  const { wb } = useWorkbench();
  const { activeTab, setActiveTab, handleOpenCreateTxModal } = wb;
  return (
    <>
      {/* Bottom Navigation Mobile + Floating Action Button (Thumb Zone - DESIGN_SYSTEM.md) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around">
        {[
          { id: 'overview', label: 'Início', icon: BarChart3 },
          { id: 'ai', label: 'IA', icon: Sparkles },
          { id: 'comparison', label: 'Comparar', icon: ArrowLeftRight },
          { id: 'goals', label: 'Metas', icon: Target },
          { id: 'forecast', label: 'Previsão', icon: CalendarClock },
          { id: 'accounts', label: 'Contas', icon: CreditCardIcon },
          { id: 'transactions', label: 'Extrato', icon: Receipt },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as ActiveTab)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[11px] font-medium ${
                active
                  ? 'text-zinc-900 dark:text-zinc-50 font-semibold'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}
            >
              <Icon className="h-4 w-4 mb-0.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Botão Flutuante Mobile (+ Novo Lançamento) */}
      <button
        type="button"
        onClick={() => handleOpenCreateTxModal()}
        aria-label="Novo Lançamento"
        className="sm:hidden fixed right-4 bottom-20 z-40 h-12 px-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 shadow-xl flex items-center gap-2 font-medium text-sm"
      >
        <Plus className="h-4 w-4" />
        Lançar
      </button>
    </>
  );
}