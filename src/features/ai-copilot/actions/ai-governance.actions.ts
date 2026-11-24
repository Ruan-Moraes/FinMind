'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/lib/prisma';
import { requireAuthenticatedUser } from '@/features/auth';
import { encryptSecret } from '@/features/auth/domain/secret-crypto';
import {
  PROVIDER_STATIC_META,
  type AiProviderId,
  type ProviderIntegrationState,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { isAuthenticApiKey } from '@/features/ai-copilot/models';
import { resolveUserProviderCredentials } from '@/features/ai-copilot/services/ai-credentials-service';
import { invalidateProviderModelsCache } from '@/features/ai-copilot/services/official-models-discovery';
import { buildProviderIntegrationState } from '@/features/ai-copilot/services/ai-provider-state-service';

/**
 * Salva (criptografada) a chave de API de um provedor específico, invalida cache,
 * valida imediatamente na API oficial de modelos e retorna o estado autoritativo atualizado.
 */
export async function saveProviderCredentialsAction(data: {
  provider: AiProviderId;
  apiKey: string;
  modelId?: string;
  activateProvider?: boolean;
}): Promise<
  | { ok: true; state: ProviderIntegrationState; activeProvider: AiProviderId }
  | { ok: false; error: string }
> {
  const user = await requireAuthenticatedUser();
  const { provider } = data;
  const meta = PROVIDER_STATIC_META[provider];
  const incomingKey = data.apiKey.trim();

  if (!isAuthenticApiKey(incomingKey)) {
    return {
      ok: false,
      error: `Informe uma chave de API válida para ${meta.name} (ex.: ${meta.keyPlaceholder}).`,
    };
  }

  const encrypted = encryptSecret(incomingKey);
  const cleanModel = data.modelId?.trim();

  try {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aiProvider: data.activateProvider === false ? 'OPENAI' : provider,
        aiConnectionMode: 'API_KEY',
        [meta.dbKeyField]: encrypted,
        ...(cleanModel ? { [meta.dbModelField]: cleanModel } : {}),
      },
      update: {
        aiConnectionMode: 'API_KEY',
        ...(data.activateProvider !== false ? { aiProvider: provider } : {}),
        [meta.dbKeyField]: encrypted,
        ...(cleanModel !== undefined ? { [meta.dbModelField]: cleanModel } : {}),
      },
    });

    invalidateProviderModelsCache(user.id, provider);
    const bundle = await resolveUserProviderCredentials(user.id);
    const state = await buildProviderIntegrationState({
      userId: user.id,
      cred: bundle.providers[provider],
      validateLive: true,
      forceRefresh: true,
    });

    // Se ainda não havia modelo salvo para este provedor e a API retornou modelos compatíveis,
    // NÃO substitui um modelo já escolhido; apenas preenche quando o campo estava vazio.
    if (!state.selectedModelId && state.models.length > 0) {
      const firstCompatible = state.models.find((m) => m.compatibleWithApp) || state.models[0];
      if (firstCompatible) {
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: { [meta.dbModelField]: firstCompatible.id },
        });
        state.selectedModelId = firstCompatible.id;
        state.selectedModelAvailable = true;
      }
    }

    revalidatePath('/');
    return { ok: true, state, activeProvider: bundle.activeProvider };
  } catch (err) {
    console.error('[saveProviderCredentialsAction]', err);
    return { ok: false, error: 'Não foi possível salvar a credencial do provedor.' };
  }
}

/**
 * Remove a chave de API armazenada para um provedor, invalida cache e retorna o novo estado.
 */
export async function removeProviderCredentialsAction(data: {
  provider: AiProviderId;
}): Promise<
  | { ok: true; state: ProviderIntegrationState }
  | { ok: false; error: string }
> {
  const user = await requireAuthenticatedUser();
  const meta = PROVIDER_STATIC_META[data.provider];

  try {
    await prisma.userSettings.updateMany({
      where: { userId: user.id },
      data: { [meta.dbKeyField]: null, aiConnectionMode: 'API_KEY' },
    });
    invalidateProviderModelsCache(user.id, data.provider);

    const bundle = await resolveUserProviderCredentials(user.id);
    const state = await buildProviderIntegrationState({
      userId: user.id,
      cred: bundle.providers[data.provider],
      validateLive: Boolean(bundle.providers[data.provider].effectiveKey),
      forceRefresh: true,
    });

    revalidatePath('/');
    return { ok: true, state };
  } catch (err) {
    console.error('[removeProviderCredentialsAction]', err);
    return { ok: false, error: 'Não foi possível remover a credencial do provedor.' };
  }
}

/**
 * Seleciona o provedor ativo e/ou o modelo de um provedor específico (sem disparar inferência paga).
 */
export async function selectActiveAiModelAction(data: {
  provider: AiProviderId;
  modelId: string;
}): Promise<{ ok: true; provider: AiProviderId; modelId: string } | { ok: false; error: string }> {
  const user = await requireAuthenticatedUser();
  const meta = PROVIDER_STATIC_META[data.provider];
  const cleanModel = data.modelId.trim();

  try {
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        aiProvider: data.provider,
        aiConnectionMode: 'API_KEY',
        [meta.dbModelField]: cleanModel,
      },
      update: {
        aiProvider: data.provider,
        aiConnectionMode: 'API_KEY',
        ...(cleanModel ? { [meta.dbModelField]: cleanModel } : {}),
      },
    });
    revalidatePath('/');
    return { ok: true, provider: data.provider, modelId: cleanModel };
  } catch (err) {
    console.error('[selectActiveAiModelAction]', err);
    return { ok: false, error: 'Não foi possível salvar a seleção do modelo.' };
  }
}
