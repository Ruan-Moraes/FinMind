'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';

import { Settings, Sun, Moon, LogOut, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Modal } from '@/shared/ui/modal';
import { FormField, Input, Select, Switch } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';

import { logoutAction } from '@/features/auth/actions/auth-settings.actions';
import { useSettingsForm } from '@/features/dashboard/hooks/use-settings-reset-forms';
import { DataExportCard } from '@/features/transactions/components/data-export-card';
import { SnapshotBackupCard } from '@/features/dashboard/components/snapshot-backup-card';
import { HolidaysSettingsCard } from '@/features/planning/components/holidays-settings-card';
import { HolidaysManagerModal } from '@/features/planning/components/holidays-manager-modal';

export function SettingsModal() {
  const { props, wb } = useWorkbench();
  const { user, settings } = props;
  const {
    router, hideValues, setHideValues, theme, setTheme, density, setDensity,
    activeModal, closeModal, handleOpenResetModal, activeAccounts,
  } = wb;
  const isSettingsModalOpen = activeModal?.type === 'SETTINGS';
  const [isHolidaysOpen, setIsHolidaysOpen] = React.useState(false);
  const {
    cfgFiscalDay, setCfgFiscalDay, cfgDefaultAccount, setCfgDefaultAccount,
    cfgHolidayState, setCfgHolidayState, cfgHolidayCity, setCfgHolidayCity,
    isSubmitting, handleSaveUserSettings,
  } = useSettingsForm({
    initialFiscalDay: settings.fiscalMonthStartDay,
    initialDefaultAccount: settings.defaultAccountId || '',
    initialHolidayState: settings.holidayState || '',
    initialHolidayCity: settings.holidayCity || '',
    theme, density, hideValues, onClose: closeModal,
  });
  return (
    <>
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={closeModal}
        maxWidth="2xl"
        title="Configurações & Preferências"
        subtitle="Suas preferências ficam salvas automaticamente na sua conta"
        footer={
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button variant="destructive" size="md" onClick={() => logoutAction()}>
              <LogOut className="h-4 w-4" />
              Encerrar Sessão
            </Button>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" size="md" onClick={closeModal}>
                Cancelar
              </Button>
              <Button data-agent-id="modal.settings.btn.submit" variant="primary" size="md" type="submit" form="form-user-settings" isLoading={isSubmitting}>
                Salvar Preferências
              </Button>
            </div>
          </div>
        }
      >
        <form id="form-user-settings" onSubmit={handleSaveUserSettings} className="space-y-6">
          {/* Card do Usuário Autenticado */}
          <div className="rounded-2xl bg-slate-50/80 dark:bg-zinc-950/90 p-4 border border-slate-200/90 dark:border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-semibold text-sm shrink-0">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-medium text-slate-400 dark:text-zinc-500 block">
                  Usuário Exclusivo Autenticado
                </span>
                <div className="text-sm font-semibold text-slate-900 dark:text-zinc-100 mt-0.5">
                  {user.name}{' '}
                  <span className="font-normal text-slate-500 dark:text-zinc-400">
                    ({user.email})
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="income" className="py-1 px-3">
              Conta Sincronizada
            </Badge>
          </div>

          {/* Seletor Visual Rápido de Tema */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-medium text-slate-700 dark:text-zinc-300">
                Aparência da Interface
              </label>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                Salvo automaticamente
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'DARK', label: 'Modo Escuro', sub: 'Conforto visual', icon: Moon },
                { id: 'LIGHT', label: 'Modo Claro', sub: 'Visual limpo', icon: Sun },
                { id: 'SYSTEM', label: 'Sistema', sub: 'Automático', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const active = theme === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTheme(item.id as 'LIGHT' | 'DARK' | 'SYSTEM')}
                    className={`rounded-xl border p-3.5 text-left transition-all flex items-center gap-3 ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500 text-slate-900 dark:text-zinc-50'
                        : 'border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        active
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-200/70 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                        {item.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Simétrico de Preferências Operacionais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Conta Padrão para Lançar" hint="Pré-selecionada">
              <Select
                value={cfgDefaultAccount}
                onChange={(e) => setCfgDefaultAccount(e.target.value)}
              >
                <option value="">Nenhuma selecionada</option>
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Densidade de Tabelas" hint="Espaçamento">
              <Select
                value={density}
                onChange={(e) => setDensity(e.target.value as 'COMFORTABLE' | 'COMPACT')}
              >
                <option value="COMFORTABLE">Confortável (Padrão)</option>
                <option value="COMPACT">Compacta (Mais linhas)</option>
              </Select>
            </FormField>

            <FormField label="Início do Ciclo Mensal" hint="1 a 31">
              <Input
                type="number"
                min={1}
                max={31}
                tabular
                prefixText="Dia"
                value={cfgFiscalDay}
                onChange={(e) => setCfgFiscalDay(Number(e.target.value))}
              />
            </FormField>
          </div>

          {/* Toggle de Privacidade Padronizado */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-slate-50/40 dark:bg-zinc-950/60 p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                Iniciar com Valores Ocultos (Modo Privacidade)
              </div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">
                Mascara automaticamente os saldos e faturas com <code className="font-mono">R$ ••••••</code> ao abrir o sistema
              </div>
            </div>
            <Switch
              checked={hideValues}
              onCheckedChange={setHideValues}
              label="Iniciar com Valores Ocultos"
            />
          </div>

          <HolidaysSettingsCard
            holidayState={cfgHolidayState} setHolidayState={setCfgHolidayState}
            holidayCity={cfgHolidayCity} setHolidayCity={setCfgHolidayCity}
            onOpenHolidaysModal={() => setIsHolidaysOpen(true)}
          />
          <DataExportCard />
          <SnapshotBackupCard />

          {/* Sessão Autenticada & Logout */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 bg-slate-50/40 dark:bg-zinc-950/60 p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">Sessão Ativa: {user.name}</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400">{user.email} • Protegido por sessão autenticada</div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={async () => { await logoutAction(); router.refresh(); }}>
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Encerrar Sessão</span>
            </Button>
          </div>

          {/* Zona de Perigo: Limpar ou Resetar Dados */}
          <div data-agent-id="modal.settings.dangerZone" data-agent-sensitive="true" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Limpar ou Resetar Dados Financeiros
              </div>
              <div className="text-xs text-rose-600/80 dark:text-rose-400/80">
                Escolha entre zerar apenas lançamentos e saldos (mantendo categorias, metas e contas) ou apagar tudo do zero, com dupla confirmação.
              </div>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleOpenResetModal}
              className="shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span>Limpar / Resetar</span>
            </Button>
          </div>
        </form>
      </Modal>
      <HolidaysManagerModal
        isOpen={isHolidaysOpen} onClose={() => setIsHolidaysOpen(false)}
        draftStateCode={cfgHolidayState} draftCityName={cfgHolidayCity}
      />
    </>
  );
}