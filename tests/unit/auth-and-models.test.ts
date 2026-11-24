import { describe, it, expect } from 'vitest';
import { signSessionJwt, verifySessionJwt } from '@/features/auth';
import {
  buildDynamicModelDescriptor,
  classifyProviderError,
  findStrictAiModelDescriptor,
  isAuthenticApiKey,
  maskApiKey,
  resolveDynamicModelRoute,
  validateModelIdentityResponse,
} from '@/features/ai-copilot/models';
import { mapDiagnosticCodeToProviderStatus } from '@/features/ai-copilot/domain/ai-provider-types';

describe('Autenticação JWT, Roteamento Dinâmico de Modelos e Classificação de Erros', () => {
  it('assina e valida JWT de sessão principal preservando payload', async () => {
    const token = await signSessionJwt({
      userId: 'user-1',
      email: 'ruan@finmind.app',
      name: 'Ruan',
    });
    const payload = await verifySessionJwt(token);
    expect(payload?.userId).toBe('user-1');
    expect(payload?.email).toBe('ruan@finmind.app');
  });

  it('reconhece dinamicamente modelos atuais e futuros sem depender de lista estática', () => {
    const futureOpenAi = findStrictAiModelDescriptor('gpt-7-turbo', 'OPENAI');
    expect(futureOpenAi?.provider).toBe('OPENAI');
    expect(futureOpenAi?.upstreamApiModel).toBe('gpt-7-turbo');

    const futureClaude = findStrictAiModelDescriptor('claude-5-sonnet-20270101', 'CLAUDE');
    expect(futureClaude?.provider).toBe('CLAUDE');
    expect(futureClaude?.endpointUrl).toBe('https://api.anthropic.com/v1/messages');

    const futureGemini = buildDynamicModelDescriptor('GEMINI', 'gemini-4.5-pro');
    expect(futureGemini.provider).toBe('GEMINI');
    expect(futureGemini.endpointUrl).toContain('gemini-4.5-pro:generateContent');
  });

  it('envia chave Gemini no header x-goog-api-key (nunca na URL) e rejeita chaves mascaradas/criptografadas', () => {
    expect(isAuthenticApiKey('sk-proj-1234567890abcdef')).toBe(true);
    expect(isAuthenticApiKey('enc:v1:abc:def:ghi')).toBe(false);
    expect(isAuthenticApiKey('sk-proj••••cdef')).toBe(false);
    expect(isAuthenticApiKey('')).toBe(false);
    expect(maskApiKey('sk-proj-1234567890abcdef')).toBe('sk-proj••••cdef');

    const route = resolveDynamicModelRoute(
      'gemini-2.5-flash',
      { geminiApiKey: 'AIzaSyFakeKeyForHeaderTest12345' },
      'GEMINI'
    );
    expect(route.hasExternalApiKey).toBe(true);
    expect(route.endpointUrl).not.toContain('key=');
    expect(route.headers['x-goog-api-key']).toBe('AIzaSyFakeKeyForHeaderTest12345');
  });

  it('classifica corretamente erros HTTP em códigos diagnósticos e estados de provedor', () => {
    expect(mapDiagnosticCodeToProviderStatus(classifyProviderError(401, 'Incorrect API key'))).toBe('INVALID_CREDENTIALS');
    expect(mapDiagnosticCodeToProviderStatus(classifyProviderError(403, 'Permission denied'))).toBe('ACCESS_RESTRICTED');
    expect(mapDiagnosticCodeToProviderStatus(classifyProviderError(429, 'Quota exceeded'))).toBe('QUOTA_EXCEEDED');
    expect(mapDiagnosticCodeToProviderStatus(classifyProviderError(402, 'Insufficient billing credit'))).toBe('QUOTA_EXCEEDED');
    expect(mapDiagnosticCodeToProviderStatus(classifyProviderError(503, 'Service unavailable'))).toBe('UNAVAILABLE');
    // 404 de modelo descontinuado não marca a credencial como inválida
    expect(classifyProviderError(404, 'Model not found')).toBe('MODEL_UNAVAILABLE');
    expect(mapDiagnosticCodeToProviderStatus('MODEL_UNAVAILABLE')).toBe('CONNECTED');
  });

  it('valida identidade textual do modelo sem cruzar provedores', () => {
    expect(validateModelIdentityResponse('gpt-4o', 'Sou o modelo GPT-4o da OpenAI.', 'OPENAI').passed).toBe(true);
    expect(validateModelIdentityResponse('gpt-4o', 'Sou o Claude da Anthropic.', 'OPENAI').passed).toBe(false);
    expect(validateModelIdentityResponse('claude-3-7-sonnet', 'Sou o Claude da Anthropic.', 'CLAUDE').passed).toBe(true);
  });
});
