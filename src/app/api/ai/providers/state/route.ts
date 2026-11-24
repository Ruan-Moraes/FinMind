import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  AI_PROVIDER_IDS,
  type AiProviderId,
} from '@/features/ai-copilot/domain/ai-provider-types';
import { buildAuthoritativeGlobalAiState } from '@/features/ai-copilot/services/ai-provider-state-service';

export const dynamic = 'force-dynamic';

function parseRefreshTargets(raw?: string | null): AiProviderId[] {
  if (!raw) return [];
  const up = raw.toUpperCase().trim();
  if (up === 'ALL') return [...AI_PROVIDER_IDS];
  if (up === 'OPENAI' || up === 'GEMINI' || up === 'CLAUDE') return [up];
  return [];
}

/**
 * GET /api/ai/providers/state?refresh=OPENAI|GEMINI|CLAUDE|ALL
 * Fonte única e autoritativa de estado dos 3 provedores de IA para o usuário autenticado.
 * Nunca expõe chaves em texto puro; valida credenciais existentes via endpoints oficiais de modelos.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const refreshTargets = parseRefreshTargets(req.nextUrl.searchParams.get('refresh'));
    const validateParam = req.nextUrl.searchParams.get('validate');
    const validateLive = validateParam !== 'false';

    const state = await buildAuthoritativeGlobalAiState(user.id, {
      validateLive,
      forceRefreshProviders: refreshTargets,
    });

    return NextResponse.json({ ok: true, state });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}
