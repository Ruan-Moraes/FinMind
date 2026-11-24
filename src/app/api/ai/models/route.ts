import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import { isAuthenticApiKey, type AiProviderId } from '@/features/ai-copilot/models';
import {
  fetchLiveProviderModels,
  getFallbackModelsForProvider,
} from '@/features/ai-copilot/providers/provider-models-discovery';

export const dynamic = 'force-dynamic';

function parseProvider(raw?: string | null): AiProviderId {
  const upper = String(raw || 'GEMINI').toUpperCase().trim();
  if (upper === 'OPENAI' || upper === 'CLAUDE' || upper === 'GEMINI') return upper;
  return 'GEMINI';
}

export async function GET(req: NextRequest) {
  const provider = parseProvider(req.nextUrl.searchParams.get('provider'));
  try {
    const user = await requireAuthenticatedUser();
    const userKey =
      provider === 'OPENAI'
        ? user.settings?.openaiApiKey
        : provider === 'CLAUDE'
        ? user.settings?.claudeApiKey
        : user.settings?.geminiApiKey;
    const envKey =
      provider === 'OPENAI'
        ? process.env.OPENAI_API_KEY
        : provider === 'CLAUDE'
        ? process.env.ANTHROPIC_API_KEY
        : process.env.GEMINI_API_KEY;
    const effectiveKey = isAuthenticApiKey(userKey) ? userKey : envKey;

    if (!isAuthenticApiKey(effectiveKey)) {
      return NextResponse.json({
        ok: true,
        provider,
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider(provider),
      });
    }

    const result = await fetchLiveProviderModels(provider, effectiveKey || '');
    return NextResponse.json({
      ok: result.ok,
      provider,
      source:
        provider === 'GEMINI' && result.source === 'LIVE_PROVIDER_API'
          ? 'LIVE_GOOGLE_API'
          : result.source,
      models: result.models,
      error: result.error || null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider,
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider(provider),
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  let provider: AiProviderId = 'GEMINI';
  try {
    await requireAuthenticatedUser();
    const body = (await req.json().catch(() => ({}))) as { provider?: string; apiKey?: string };
    provider = parseProvider(body.provider);
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

    const result = await fetchLiveProviderModels(provider, apiKey);
    return NextResponse.json(
      {
        ok: result.ok,
        provider,
        source:
          provider === 'GEMINI' && result.source === 'LIVE_PROVIDER_API'
            ? 'LIVE_GOOGLE_API'
            : result.source,
        models: result.models,
        error: result.error || null,
      },
      { status: result.ok ? 200 : result.httpStatus || 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider,
        source: 'FALLBACK_CATALOG',
        models: getFallbackModelsForProvider(provider),
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}
