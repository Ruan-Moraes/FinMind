import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import type { AiProviderId } from '@/features/ai-copilot/domain/ai-provider-types';
import { resolveUserProviderCredentials } from '@/features/ai-copilot/services/ai-credentials-service';
import { discoverOfficialProviderModels } from '@/features/ai-copilot/services/official-models-discovery';

export const dynamic = 'force-dynamic';

function parseProvider(raw?: string | null): AiProviderId {
  const upper = String(raw || 'OPENAI').toUpperCase().trim();
  if (upper === 'OPENAI' || upper === 'CLAUDE' || upper === 'GEMINI') return upper;
  return 'OPENAI';
}

export async function GET(req: NextRequest) {
  const provider = parseProvider(req.nextUrl.searchParams.get('provider'));
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1' || req.nextUrl.searchParams.get('refresh') === 'true';

  try {
    const user = await requireAuthenticatedUser();
    const bundle = await resolveUserProviderCredentials(user.id);
    const cred = bundle.providers[provider];

    if (!cred.effectiveKey) {
      return NextResponse.json({
        ok: false,
        provider,
        models: [],
        diagnosticCode: 'MISSING_CREDENTIALS',
        error: 'Nenhuma chave de API configurada para este provedor.',
      });
    }

    const result = await discoverOfficialProviderModels({
      userId: user.id,
      provider,
      apiKey: cred.effectiveKey,
      forceRefresh,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        provider,
        models: result.models,
        fetchedAt: result.fetchedAt,
        fromCache: result.fromCache,
        diagnosticCode: result.diagnosticCode || null,
        error: result.error || null,
      },
      { status: result.ok ? 200 : result.httpStatus || 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider,
        models: [],
        diagnosticCode: 'AUTH_ERROR',
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}

export async function POST(req: NextRequest) {
  let provider: AiProviderId = 'OPENAI';
  try {
    const user = await requireAuthenticatedUser();
    const body = (await req.json().catch(() => ({}))) as { provider?: string; apiKey?: string };
    provider = parseProvider(body.provider);
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

    const result = await discoverOfficialProviderModels({
      userId: user.id,
      provider,
      apiKey,
      forceRefresh: true,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        provider,
        models: result.models,
        fetchedAt: result.fetchedAt,
        diagnosticCode: result.diagnosticCode || null,
        error: result.error || null,
      },
      { status: result.ok ? 200 : result.httpStatus || 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider,
        models: [],
        diagnosticCode: 'AUTH_ERROR',
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}
