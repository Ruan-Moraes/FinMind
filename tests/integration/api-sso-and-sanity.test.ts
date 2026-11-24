import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  handleSsoStatusGet,
  handleSsoAuthenticateOrRevokePost,
} from '@/features/auth/services/sso-api-handlers';
import {
  handleSanityCheckGet,
  handleSanityCheckPost,
} from '@/features/ai-copilot/providers/sanity-check-api-handlers';

describe('Integração API Routes: /api/sso e /api/ai/sanity-check', () => {
  it('GET /api/sso retorna matriz de provedores configurados e status de sessão', async () => {
    const req = new NextRequest('http://localhost:3000/api/sso', {
      method: 'GET',
    });
    const res = await handleSsoStatusGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.configuredProviders).toBeDefined();
    expect(json.configuredProviders.OPENAI).toBeDefined();
    expect(json.configuredProviders.GEMINI).toBeDefined();
    expect(json.configuredProviders.CLAUDE).toBeDefined();
  });

  it('POST /api/sso bloqueia login simulado (popup_login sem API key autêntica) e rejeita chaves malformadas', async () => {
    const popupReq = new NextRequest('http://localhost:3000/api/sso', {
      method: 'POST',
      body: JSON.stringify({
        action: 'popup_login',
        provider: 'OPENAI',
        apiKey: '',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const popupRes = await handleSsoAuthenticateOrRevokePost(popupReq);
    const popupJson = await popupRes.json();

    expect(popupRes.status).toBe(401);
    expect(popupJson.ok).toBe(false);
    expect(popupJson.diagnosticCode).toBe('MISSING_CREDENTIALS');

    const badKeyReq = new NextRequest('http://localhost:3000/api/sso', {
      method: 'POST',
      body: JSON.stringify({
        action: 'authenticate',
        provider: 'OPENAI',
        apiKey: 'short',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const badKeyRes = await handleSsoAuthenticateOrRevokePost(badKeyReq);
    const badKeyJson = await badKeyRes.json();

    expect(badKeyRes.status).toBe(400);
    expect(badKeyJson.ok).toBe(false);
    expect(badKeyJson.diagnosticCode).toBe('INVALID_CREDENTIALS');

    const revokeReq = new NextRequest('http://localhost:3000/api/sso', {
      method: 'POST',
      body: JSON.stringify({
        action: 'revoke',
        provider: 'OPENAI',
      }),
      headers: { 'content-type': 'application/json' },
    });
    const revokeRes = await handleSsoAuthenticateOrRevokePost(revokeReq);
    const revokeJson = await revokeRes.json();
    expect(revokeRes.status).toBe(200);
    expect(revokeJson.ok).toBe(true);
  });

  it('POST /api/ai/sanity-check retorna 404 MODEL_UNAVAILABLE para modelo inexistente e GET /api/ai/sanity-check lista catálogo', async () => {
    const invalidModelReq = new NextRequest('http://localhost:3000/api/ai/sanity-check', {
      method: 'POST',
      body: JSON.stringify({
        modelId: 'gpt-99-inexistente',
        persistSelection: false,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const invalidRes = await handleSanityCheckPost(invalidModelReq);
    const invalidJson = await invalidRes.json();

    expect(invalidRes.status).toBe(404);
    expect(invalidJson.ok).toBe(false);
    expect(invalidJson.sanityCheck.diagnosticCode).toBe('MODEL_UNAVAILABLE');

    const getReq = new NextRequest(
      'http://localhost:3000/api/ai/sanity-check?modelId=gpt-4o-mini',
      { method: 'GET' }
    );
    const getRes = await handleSanityCheckGet(getReq);
    const getJson = await getRes.json();

    expect(Array.isArray(getJson.availableModels)).toBe(true);
    expect(getJson.availableModels.length).toBeGreaterThanOrEqual(9);
  });
});
