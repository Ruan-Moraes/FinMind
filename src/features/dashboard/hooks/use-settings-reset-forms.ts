'use client';

import * as React from 'react';
import { updateUserSettingsAction, resetAllFinancialDataAction } from '@/features/auth/actions/auth-settings.actions';

export function useSettingsForm(params: {
  initialFiscalDay: number;
  initialDefaultAccount: string;
  initialHolidayState: string;
  initialHolidayCity: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  density: 'COMFORTABLE' | 'COMPACT';
  hideValues: boolean;
  onClose: () => void;
}) {
  const {
    initialFiscalDay, initialDefaultAccount, initialHolidayState, initialHolidayCity,
    theme, density, hideValues, onClose,
  } = params;
  const [cfgFiscalDay, setCfgFiscalDay] = React.useState(initialFiscalDay);
  const [cfgDefaultAccount, setCfgDefaultAccount] = React.useState(initialDefaultAccount);
  const [cfgHolidayState, setCfgHolidayState] = React.useState(initialHolidayState);
  const [cfgHolidayCity, setCfgHolidayCity] = React.useState(initialHolidayCity);
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    setCfgFiscalDay(initialFiscalDay);
    setCfgDefaultAccount(initialDefaultAccount);
    setCfgHolidayState(initialHolidayState);
    setCfgHolidayCity(initialHolidayCity);
    setSettingsError(null);
  }, [initialFiscalDay, initialDefaultAccount, initialHolidayState, initialHolidayCity]);

  const handleSaveUserSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    if (!Number.isInteger(cfgFiscalDay) || cfgFiscalDay < 1 || cfgFiscalDay > 31) {
      setSettingsError('O dia de início do ciclo mensal deve estar entre 1 e 31.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await updateUserSettingsAction({
        theme,
        density,
        hideValuesByDefault: hideValues,
        fiscalMonthStartDay: cfgFiscalDay,
        defaultAccountId: cfgDefaultAccount || null,
        holidayState: cfgHolidayState || null,
        holidayCity: cfgHolidayCity.trim() || null,
      });
      if (!res.ok) {
        setSettingsError(res.error || 'Não foi possível salvar as preferências.');
        return;
      }
      onClose();
    } catch {
      setSettingsError('Erro de comunicação ao salvar preferências.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    cfgFiscalDay, setCfgFiscalDay,
    cfgDefaultAccount, setCfgDefaultAccount,
    cfgHolidayState, setCfgHolidayState,
    cfgHolidayCity, setCfgHolidayCity,
    settingsError, isSubmitting, handleSaveUserSettings,
  };
}

export function useResetForm(params: {
  isOpen: boolean;
  userName: string;
  onClose: () => void;
}) {
  const { isOpen, userName, onClose } = params;
  const [resetScope, setResetScope] = React.useState<'VALUES_ONLY' | 'ALL'>('VALUES_ONLY');
  const [resetStep, setResetStep] = React.useState<1 | 2>(1);
  const [resetFullNameInput, setResetFullNameInput] = React.useState('');
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [isResetting, setIsResetting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setResetScope('VALUES_ONLY');
      setResetStep(1);
      setResetFullNameInput('');
      setResetError(null);
    }
  }, [isOpen]);

  const handleAdvanceToResetStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = userName.trim().replace(/\s+/g, ' ').toLowerCase();
    const entered = resetFullNameInput.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!entered || entered !== expected) {
      setResetError(`O nome digitado não confere. Digite exatamente: ${userName}`);
      return;
    }
    setResetError(null);
    setResetStep(2);
  };

  const handleConfirmResetAll = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      const res = await resetAllFinancialDataAction(resetFullNameInput, resetScope);
      if (!res.ok) {
        setResetError(res.error || 'Erro ao resetar os dados.');
        setResetStep(1);
      } else {
        onClose();
      }
    } finally {
      setIsResetting(false);
    }
  };

  return {
    resetScope, setResetScope,
    resetStep, setResetStep, resetFullNameInput, setResetFullNameInput,
    resetError, setResetError, isResetting,
    handleAdvanceToResetStep2, handleConfirmResetAll,
  };
}
