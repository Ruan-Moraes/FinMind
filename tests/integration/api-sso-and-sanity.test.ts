import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { encryptSecret } from '@/features/auth/domain/secret-crypto';
import {
  resolveActiveUserAiSelection,
  resolveUserProviderCredentials,
} from '@/features/ai-copilot/services/ai-credentials-service';
import { buildAuthoritativeGlobalAiState } from '@/features/ai-copilot/services/ai-provider-state-service';
import { executeModelSanityCheck } from '@/features/ai-copilot/providers/sanity-check-runner';

describe('Integração Real: Credenciais Criptografadas, Isolamento Multi-Usuário e Estado Global IA', () => {
  let userAId = '';
  let userBId = '';

  beforeAll(async () => {
    const suffix = Date.now();
    const userA = await prisma.user.create({
      data: {
        name: 'AI Auth User A',
        email: `ai-auth-a-${suffix}@finmind.local`,
        passwordHash: 'hash',
        settings: {
          create: {
            aiProvider: 'OPENAI',
            aiConnectionMode: 'API_KEY',
            openaiApiKey: encryptSecret('sk-proj-userA-secret-1234567890'),
            geminiApiKey: encryptSecret('AIzaSyUserASecretKey1234567890'),
            claudeApiKey: null,
            openaiModel: 'gpt-4o',
            geminiModel: 'gemini-2.5-flash',
            claudeModel: '',
          },
        },
      },
    });
    userAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        name: 'AI Auth User B',
        email: `ai-auth-b-${suffix}@finmind.local`,
        passwordHash: 'hash',
        settings: {
          create: {
            aiProvider: 'CLAUDE',
            aiConnectionMode: 'API_KEY',
            openaiApiKey: null,
            geminiApiKey: null,
            claudeApiKey: encryptSecret('sk-ant-api03-userB-secret-987654'),
            claudeModel: 'claude-3-7-sonnet-latest',
          },
        },
      },
    });
    userBId = userB.id;
  });

  afterAll(async () => {
    if (userAId) await prisma.user.deleteMany({ where: { id: userAId } });
    if (userBId) await prisma.user.deleteMany({ where: { id: userBId } });
  });

  it('descriptografa credenciais independentes por provedor e isola estritamente por userId', async () => {
    const credsA = await resolveUserProviderCredentials(userAId);
    const credsB = await resolveUserProviderCredentials(userBId);

    expect(credsA.providers.OPENAI.effectiveKey).toBe('sk-proj-userA-secret-1234567890');
    expect(credsA.providers.GEMINI.effectiveKey).toBe('AIzaSyUserASecretKey1234567890');
    expect(credsA.providers.CLAUDE.hasStoredKey).toBe(false);

    expect(credsB.providers.CLAUDE.effectiveKey).toBe('sk-ant-api03-userB-secret-987654');
    expect(credsB.providers.OPENAI.hasStoredKey).toBe(false);
    expect(credsB.providers.OPENAI.effectiveKey).not.toBe(credsA.providers.OPENAI.effectiveKey);

    const activeB = await resolveActiveUserAiSelection(userBId);
    expect(activeB.provider).toBe('CLAUDE');
    expect(activeB.modelId).toBe('claude-3-7-sonnet-latest');
  });

  it('monta GlobalAiState sem expor chaves em texto puro no cliente', async () => {
    const stateA = await buildAuthoritativeGlobalAiState(userAId, { validateLive: false });
    const serialized = JSON.stringify(stateA);
    expect(serialized).not.toContain('sk-proj-userA-secret-1234567890');
    expect(serialized).not.toContain('AIzaSyUserASecretKey1234567890');
    expect(stateA.providers.OPENAI.keyPreview).toContain('••••');
    expect(stateA.providers.OPENAI.status).toBe('UNVERIFIED');
    expect(stateA.providers.CLAUDE.status).toBe('NOT_CONFIGURED');
  });

  it('rejeita sanity check sem credenciais com MISSING_CREDENTIALS e sem fallback simulado', async () => {
    const res = await executeModelSanityCheck({
      provider: 'CLAUDE',
      modelId: 'claude-3-7-sonnet-latest',
      userKeys: { openaiApiKey: null, geminiApiKey: null, claudeApiKey: null },
    });
    expect(res.passed).toBe(false);
    expect(res.diagnosticCode).toBe('MISSING_CREDENTIALS');
  });
});
