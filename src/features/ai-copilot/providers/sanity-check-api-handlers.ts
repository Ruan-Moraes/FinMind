import { NextRequest, NextResponse } from 'next/server';
import { rejectCrossOriginWrite } from '@/shared/lib/request-origin';
import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import { prisma } from '@/shared/lib/prisma';
import type { AiProviderId } from '@/features/ai-copilot/domain/ai-provider-types';
import {
  executeModelSanityCheck,
  findStrictAiModelDescriptor,
} from '@/features/ai-copilot/providers';
import { resolveUserProviderCredentials } from '@/features/ai-copilot/services/ai-credentials-service';

function parseProvider(raw?: string | null): AiProviderId | undefined {
  const up = String(raw || '').toUpperCase().trim();
  if (up === 'OPENAI' || up === 'GEMINI' || up === 'CLAUDE') return up;
  return undefined;
}

/**
 * GET /api/ai/sanity-check?provider=OPENAI&modelId=...
 * Executa teste operacional real de inferência usando as credenciais descriptografadas do usuário.
 */
export async function handleSanityCheckGet(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const bundle = await resolveUserProviderCredentials(user.id);
    const { searchParams } = new URL(req.url);
    const provider = parseProvider(searchParams.get('provider')) || bundle.activeProvider;
    const requestedModelId = searchParams.get('modelId') || bundle.providers[provider].selectedModelId;

    const result = await executeModelSanityCheck({
      provider,
      modelId: requestedModelId,
      userKeys: bundle.rawDecryptedKeys,
    });

    return NextResponse.json(
      { ok: result.passed, sanityCheck: result, error: result.error || null },
      { status: result.passed ? 200 : result.httpStatus || 401 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sessão não autenticada.' },
      { status: 401 }
    );
  }
}

/**
 * POST /api/ai/sanity-check
 * Body: { provider?: 'OPENAI'|'GEMINI'|'CLAUDE', modelId: string, persistSelection?: boolean, customPrompt?: string }
 */
export async function handleSanityCheckPost(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const blockedOrigin = rejectCrossOriginWrite(req);
    if (blockedOrigin) return blockedOrigin;

    const body = (await req.json().catch(() => ({}))) as {
      provider?: string;
      modelId?: string;
      persistSelection?: boolean;
      customPrompt?: string;
    };
    const bundle = await resolveUserProviderCredentials(user.id);
    const explicitProvider = parseProvider(body.provider);
    const targetModelId = String(body.modelId || bundle.activeModelId || '').trim();
    const descriptor = findStrictAiModelDescriptor(targetModelId, explicitProvider);

    if (!descriptor) {
      return NextResponse.json(
        { ok: false, error: 'Informe um provedor e identificador de modelo válido para testar.' },
        { status: 400 }
      );
    }

    if (body.persistSelection === true) {
      await prisma.userSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          aiProvider: descriptor.provider,
          aiConnectionMode: 'API_KEY',
          openaiModel: descriptor.provider === 'OPENAI' ? descriptor.id : '',
          geminiModel: descriptor.provider === 'GEMINI' ? descriptor.id : '',
          claudeModel: descriptor.provider === 'CLAUDE' ? descriptor.id : '',
        },
        update: {
          aiProvider: descriptor.provider,
          aiConnectionMode: 'API_KEY',
          ...(descriptor.provider === 'OPENAI' && { openaiModel: descriptor.id }),
          ...(descriptor.provider === 'GEMINI' && { geminiModel: descriptor.id }),
          ...(descriptor.provider === 'CLAUDE' && { claudeModel: descriptor.id }),
        },
      });
      revalidatePath('/');
    }

    const result = await executeModelSanityCheck({
      provider: descriptor.provider,
      modelId: descriptor.id,
      customPrompt: typeof body.customPrompt === 'string' ? body.customPrompt : undefined,
      userKeys: bundle.rawDecryptedKeys,
    });

    return NextResponse.json(
      { ok: result.passed, sanityCheck: result, error: result.error || null },
      { status: result.passed ? 200 : result.httpStatus || 401 }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Sessão não autenticada.' },
      { status: 401 }
    );
  }
}
