import { prisma } from '@/shared/lib/prisma';
import { decryptSecret } from '@/features/auth/domain/secret-crypto';
import {
  AI_PROVIDER_IDS,
  PROVIDER_STATIC_META,
  type AiProviderId,
} from '@/features/ai-copilot/domain/ai-provider-types';
import {
  isAuthenticApiKey,
  maskApiKey,
} from '@/features/ai-copilot/models/model-route-resolver';

export interface ResolvedProviderCredential {
  provider: AiProviderId;
  effectiveKey: string;
  hasStoredKey: boolean;
  hasEnvKey: boolean;
  keyPreview: string;
  credentialSource: 'USER_DB_KEY' | 'ENV_KEY' | 'NONE';
  selectedModelId: string;
}

export interface UserAiCredentialsBundle {
  activeProvider: AiProviderId;
  activeModelId: string;
  providers: Record<AiProviderId, ResolvedProviderCredential>;
  rawDecryptedKeys: {
    openaiApiKey: string;
    geminiApiKey: string;
    claudeApiKey: string;
  };
}

function readEnvKey(provider: AiProviderId): string {
  const envName = PROVIDER_STATIC_META[provider].envVarName;
  const raw = typeof process !== 'undefined' && process.env ? (process.env[envName] || '').trim() : '';
  return isAuthenticApiKey(raw) ? raw : '';
}

function normalizeProvider(raw?: string | null): AiProviderId {
  const up = String(raw || 'OPENAI').toUpperCase().trim();
  if (up === 'GEMINI' || up === 'CLAUDE' || up === 'OPENAI') return up;
  return 'OPENAI';
}

/**
 * Ponto ÚNICO e autoritativo de resolução e descriptografia de credenciais de IA por usuário.
 * Elimina divergências entre rotas/actions que antes liam `user.settings.*ApiKey` sem `decryptSecret()`.
 */
export async function resolveUserProviderCredentials(
  userId: string
): Promise<UserAiCredentialsBundle> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const activeProvider = normalizeProvider(settings?.aiProvider);

  const decryptedMap: Record<AiProviderId, string> = {
    OPENAI: decryptSecret(settings?.openaiApiKey) || '',
    GEMINI: decryptSecret(settings?.geminiApiKey) || '',
    CLAUDE: decryptSecret(settings?.claudeApiKey) || '',
  };

  const savedModels: Record<AiProviderId, string> = {
    OPENAI: (settings?.openaiModel || '').trim(),
    GEMINI: (settings?.geminiModel || '').trim(),
    CLAUDE: (settings?.claudeModel || '').trim(),
  };

  const providers = {} as Record<AiProviderId, ResolvedProviderCredential>;
  for (const provider of AI_PROVIDER_IDS) {
    const dbKey = isAuthenticApiKey(decryptedMap[provider]) ? decryptedMap[provider].trim() : '';
    const envKey = readEnvKey(provider);
    const effectiveKey = dbKey || envKey;
    const credentialSource: ResolvedProviderCredential['credentialSource'] = dbKey
      ? 'USER_DB_KEY'
      : envKey
      ? 'ENV_KEY'
      : 'NONE';

    providers[provider] = {
      provider,
      effectiveKey,
      hasStoredKey: Boolean(dbKey),
      hasEnvKey: Boolean(envKey),
      keyPreview: effectiveKey ? maskApiKey(effectiveKey) : '',
      credentialSource,
      selectedModelId: savedModels[provider],
    };
  }

  return {
    activeProvider,
    activeModelId: providers[activeProvider].selectedModelId,
    providers,
    rawDecryptedKeys: {
      openaiApiKey: providers.OPENAI.effectiveKey,
      geminiApiKey: providers.GEMINI.effectiveKey,
      claudeApiKey: providers.CLAUDE.effectiveKey,
    },
  };
}

export async function resolveActiveUserAiSelection(userId: string): Promise<{
  provider: AiProviderId;
  modelId: string;
  apiKey: string;
  hasKey: boolean;
  credentialSource: 'USER_DB_KEY' | 'ENV_KEY' | 'NONE';
  bundle: UserAiCredentialsBundle;
}> {
  const bundle = await resolveUserProviderCredentials(userId);
  const current = bundle.providers[bundle.activeProvider];
  return {
    provider: bundle.activeProvider,
    modelId: current.selectedModelId,
    apiKey: current.effectiveKey,
    hasKey: Boolean(current.effectiveKey),
    credentialSource: current.credentialSource,
    bundle,
  };
}
