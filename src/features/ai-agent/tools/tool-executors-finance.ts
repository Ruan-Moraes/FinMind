import { prisma } from '@/shared/lib/prisma';
import { updatePreferencesToolSchema } from '@/features/ai-agent/tools/tool-catalog';
import type { AgentToolExecutor } from '@/features/ai-agent/tools/tool-executor-types';

export const updateUserPreferencesExecutor: AgentToolExecutor = {
  async preparePreview(userId, rawArgs) {
    const parsed = updatePreferencesToolSchema.parse(rawArgs);
    const current = await prisma.userSettings.findUnique({ where: { userId } });

    const beforePreview: Array<{ label: string; value: string }> = [];
    const afterPreview: Array<{ label: string; value: string }> = [];
    const pushDiff = (label: string, before: string, after: string) => {
      beforePreview.push({ label, value: before });
      afterPreview.push({ label, value: after });
    };

    if (parsed.theme !== undefined) pushDiff('Tema', current?.theme || 'DARK', parsed.theme);
    if (parsed.density !== undefined) pushDiff('Densidade', current?.density || 'COMFORTABLE', parsed.density);
    if (parsed.hideValuesByDefault !== undefined) {
      pushDiff('Modo Privacidade', current?.hideValuesByDefault ? 'Ativado' : 'Desativado', parsed.hideValuesByDefault ? 'Ativado' : 'Desativado');
    }
    if (parsed.fiscalMonthStartDay !== undefined) {
      pushDiff('Início do Ciclo Mensal', `Dia ${current?.fiscalMonthStartDay ?? 1}`, `Dia ${parsed.fiscalMonthStartDay}`);
    }
    if (parsed.holidayState !== undefined) {
      pushDiff('Estado (UF)', current?.holidayState || 'Não definido', parsed.holidayState?.toUpperCase() || 'Apenas Nacionais');
    }
    if (parsed.holidayCity !== undefined) {
      pushDiff('Cidade', current?.holidayCity || 'Não definida', parsed.holidayCity || 'Não definida');
    }

    return {
      title: 'Atualizar Configurações & Preferências',
      summary: `Aplicar ${afterPreview.map((p) => `${p.label}: ${p.value}`).join(' • ')}.`,
      beforePreview,
      afterPreview,
      beforeState: {
        theme: current?.theme ?? 'DARK',
        density: current?.density ?? 'COMFORTABLE',
        hideValuesByDefault: current?.hideValuesByDefault ?? false,
        fiscalMonthStartDay: current?.fiscalMonthStartDay ?? 1,
        holidayState: current?.holidayState ?? null,
        holidayCity: current?.holidayCity ?? null,
      },
      normalizedParams: parsed,
      postConfirmVisualSteps: [
        { id: 's1', action: 'OPEN_MODAL', modalType: 'SETTINGS', targetId: 'header.btn.settings', caption: 'Abrindo Configurações & Preferências' },
        {
          id: 's2',
          action: 'SCROLL_TO',
          targetId:
            parsed.holidayState !== undefined || parsed.holidayCity !== undefined
              ? 'modal.settings.section.holidays'
              : parsed.fiscalMonthStartDay !== undefined
                ? 'modal.settings.fiscalDay'
                : 'modal.settings.section.theme',
          caption: 'Localizando seção de configurações',
          tooltipTitle: 'Aplicando Preferências',
          tooltipBody: `Atualizando ${afterPreview.map((p) => `${p.label}: ${p.value}`).join(' • ')}.`,
          tone: 'emerald',
          pauseMs: 850,
        },
        { id: 's3', action: 'HIGHLIGHT', targetId: 'modal.settings.btn.submit', caption: 'Salvando preferências no banco', pauseMs: 320 },
        { id: 's4', action: 'CLOSE_MODAL', caption: 'Configurações atualizadas' },
      ],
      reversible: true,
    };
  },

  async executeAndVerify(userId, params) {
    const parsed = updatePreferencesToolSchema.parse(params);
    const normalizedState =
      parsed.holidayState !== undefined ? (parsed.holidayState ? parsed.holidayState.toUpperCase() : null) : undefined;

    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        theme: parsed.theme || 'DARK',
        density: parsed.density || 'COMFORTABLE',
        hideValuesByDefault: parsed.hideValuesByDefault ?? false,
        fiscalMonthStartDay: parsed.fiscalMonthStartDay ?? 1,
        holidayState: normalizedState ?? null,
        holidayCity: parsed.holidayCity ?? null,
      },
      update: {
        ...(parsed.theme !== undefined && { theme: parsed.theme }),
        ...(parsed.density !== undefined && { density: parsed.density }),
        ...(parsed.hideValuesByDefault !== undefined && { hideValuesByDefault: parsed.hideValuesByDefault }),
        ...(parsed.fiscalMonthStartDay !== undefined && { fiscalMonthStartDay: parsed.fiscalMonthStartDay }),
        ...(normalizedState !== undefined && { holidayState: normalizedState }),
        ...(parsed.holidayCity !== undefined && { holidayCity: parsed.holidayCity || null }),
      },
    });

    const verifiedRow = await prisma.userSettings.findUnique({ where: { userId } });
    const verified = Boolean(
      verifiedRow &&
        (parsed.fiscalMonthStartDay === undefined || verifiedRow.fiscalMonthStartDay === parsed.fiscalMonthStartDay) &&
        (normalizedState === undefined || verifiedRow.holidayState === normalizedState) &&
        (parsed.theme === undefined || verifiedRow.theme === parsed.theme) &&
        (parsed.density === undefined || verifiedRow.density === parsed.density) &&
        (parsed.hideValuesByDefault === undefined || verifiedRow.hideValuesByDefault === parsed.hideValuesByDefault) &&
        (parsed.holidayCity === undefined || (verifiedRow.holidayCity ?? null) === (parsed.holidayCity || null))
    );

    return {
      ok: verified,
      verified,
      summary: verified
        ? 'Configurações atualizadas e verificadas na sua conta.'
        : 'Não foi possível verificar as preferências salvas.',
      afterState: verifiedRow,
    };
  },

  async rollback(userId, beforeState) {
    const prev = beforeState as {
      theme?: string;
      density?: string;
      hideValuesByDefault?: boolean;
      fiscalMonthStartDay?: number;
      holidayState?: string | null;
      holidayCity?: string | null;
    } | null;
    if (!prev) return { ok: false, summary: 'Estado anterior indisponível.' };
    await prisma.userSettings.updateMany({
      where: { userId },
      data: {
        theme: prev.theme || 'DARK',
        density: prev.density || 'COMFORTABLE',
        hideValuesByDefault: Boolean(prev.hideValuesByDefault),
        fiscalMonthStartDay: prev.fiscalMonthStartDay ?? 1,
        holidayState: prev.holidayState ?? null,
        holidayCity: prev.holidayCity ?? null,
      },
    });
    return { ok: true, summary: 'Configurações anteriores restauradas com sucesso.' };
  },
};
