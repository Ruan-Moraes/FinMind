import { describe, it, expect } from 'vitest';
import { signSessionJwt, verifySessionJwt } from '@/features/auth/domain/jwt-session';
import { signSsoJwtToken, verifySsoJwtToken } from '@/features/auth/domain/sso-jwt';
import {
  getActiveSsoSession,
  issueSsoSessionCookie,
  revokeSsoSessionCookie,
} from '@/features/auth/services/sso-cookies';
import { getSession, isSessionExplicitlyLoggedOut } from '@/features/auth/services/session-cookies';
import { encryptSecret, decryptSecret } from '@/features/auth/domain/secret-crypto';
import { fetchLiveGeminiModels } from '@/features/ai-copilot/providers/gemini-models-discovery';
import { resolveCategoryIconId } from '@/shared/icons/icon-inference';
import {
  AI_MODELS_CATALOG,
  SSO_POPUP_TOKEN_PREFIX,
  getAiModelDescriptor,
  findStrictAiModelDescriptor,
  isAuthenticApiKey,
  maskApiKey,
  resolveDynamicModelRoute,
} from '@/features/ai-copilot/models';

describe('Núcleo Puro: Autenticação JWT, SSO, Ícones e Catálogo de Modelos IA', () => {
  it('assina e verifica tokens de sessão JWT', async () => {
    const token = await signSessionJwt({
      userId: 'u-1',
      email: 'teste@finmind.app',
      name: 'Teste',
    });
    const decoded = await verifySessionJwt(token);
    expect(decoded?.userId).toBe('u-1');
    expect(decoded?.email).toBe('teste@finmind.app');
    expect(await verifySessionJwt('token-invalido')).toBeNull();
  });

  it('assina e valida tokens SSO com escopo ai:invoke', async () => {
    const { token, payload } = await signSsoJwtToken({
      userId: 'u-2',
      email: 'sso@finmind.app',
      name: 'SSO User',
      idpProvider: 'OPENAI_SSO',
    });
    expect(payload.scopes).toContain('ai:invoke');
    const verified = await verifySsoJwtToken(token, 'ai:invoke');
    expect(verified.valid).toBe(true);
    expect(verified.payload?.sub).toBe('u-2');

    const bad = await verifySsoJwtToken('invalid.jwt.token', 'ai:invoke');
    expect(bad.valid).toBe(false);
  });

  it('valida helpers de cookie/header SSO e sessão fora do ciclo HTTP', async () => {
    const issued = await issueSsoSessionCookie({
      userId: 'u-cookie',
      email: 'cookie@finmind.local',
      name: 'Cookie User',
      idpProvider: 'OPENAI_SSO',
    });
    expect(issued.token.length).toBeGreaterThan(20);

    const active = await getActiveSsoSession(`Bearer ${issued.token}`);
    expect(active.authenticated).toBe(true);
    expect(active.session?.email).toBe('cookie@finmind.local');

    const invalid = await getActiveSsoSession('Bearer token-invalido');
    expect(invalid.authenticated).toBe(false);

    await revokeSsoSessionCookie();
    expect(await getSession()).toBeNull();
    expect(await isSessionExplicitlyLoggedOut()).toBe(false);
  });

  it('infere ícones semânticos de categorias', () => {
    expect(resolveCategoryIconId(null, 'Supermercado')).toBe('ShoppingCart');
    expect(resolveCategoryIconId(null, 'Moradia & Aluguel')).toBe('Home');
    expect(resolveCategoryIconId('Briefcase', 'Qualquer')).toBe('Briefcase');
  });

  it('valida chaves autênticas, mascaramento e resolução dinâmica de rotas dos modelos', () => {
    expect(AI_MODELS_CATALOG.length).toBeGreaterThanOrEqual(9);
    expect(getAiModelDescriptor('gpt-4o-mini').provider).toBe('OPENAI');
    expect(findStrictAiModelDescriptor('modelo-inexistente')).toBeNull();

    expect(isAuthenticApiKey('sk-proj-1234567890abcdef')).toBe(true);
    expect(isAuthenticApiKey(`${SSO_POPUP_TOKEN_PREFIX}fake`)).toBe(false);
    expect(isAuthenticApiKey('short')).toBe(false);
    expect(maskApiKey('sk-proj-1234567890abcdef')).toContain('••••');

    const route = resolveDynamicModelRoute('gemini-2.0-flash', {
      geminiApiKey: 'AIzaSyFakeKey1234567890',
    });
    expect(route.provider).toBe('GEMINI');
    expect(route.resolvedCredentialSource).toBe('USER_DB_KEY');
    expect(route.endpointUrl).toContain('gemini-2.0-flash');
  });

  it('cifra e decifra chaves de API com AES-256-GCM preservando retrocompatibilidade', () => {
    const rawKey = 'sk-proj-test-secret-key-9876543210abcdef';
    const encrypted = encryptSecret(rawKey);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain(rawKey);
    expect(decryptSecret(encrypted)).toBe(rawKey);
    expect(encryptSecret(encrypted)).toBe(encrypted);
    expect(decryptSecret('legacy-plaintext-key-123')).toBe('legacy-plaintext-key-123');
    expect(decryptSecret('enc:v1:00:00:corrupted')).toBe('');
    expect(encryptSecret('')).toBe('');
  });

  it('aceita modelos Gemini dinâmicos e descobre lista ativa via endpoint oficial da Google', async () => {
    const dynamicDesc = findStrictAiModelDescriptor('gemini-3.0-flash-preview');
    expect(dynamicDesc?.provider).toBe('GEMINI');
    expect(dynamicDesc?.id).toBe('gemini-3.0-flash-preview');
    expect(dynamicDesc?.endpointUrl).toContain('gemini-3.0-flash-preview:generateContent');

    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          models: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1048576,
            },
            {
              name: 'models/gemini-3-pro-preview',
              displayName: 'Gemini 3 Pro Preview',
              supportedGenerationMethods: ['generateContent'],
              inputTokenLimit: 1048576,
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Embedding',
              supportedGenerationMethods: ['embedContent'],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const live = await fetchLiveGeminiModels('AIzaSyValidDynamicTestKey12345');
      expect(live.ok).toBe(true);
      expect(live.source).toBe('LIVE_GOOGLE_API');
      expect(live.models.map((m) => m.id)).toContain('gemini-2.5-flash');
      expect(live.models.map((m) => m.id)).toContain('gemini-3-pro-preview');
      expect(live.models.map((m) => m.id)).not.toContain('text-embedding-004');
    } finally {
      globalThis.fetch = prevFetch;
    }
  });
});
