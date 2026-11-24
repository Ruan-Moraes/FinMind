import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import { prisma } from '@/shared/lib/prisma';
import { getActiveSsoSession } from '@/features/auth/sso';
import {
  executeModelSanityCheck,
  findStrictAiModelDescriptor,
  getAiModelDescriptor,
  AI_MODELS_CATALOG,
} from '@/features/ai-copilot/providers';

/**
 * Handler GET /api/ai/sanity-check?modelId=gpt-4o-mini
 * Verifica conectividade REAL, credencial oficial do provedor e executa o Sanity Check ("Qual é o seu modelo?").
 */
export async function handleSanityCheckGet(req: NextRequest) {
  try {
    const headerToken =
      req.headers.get('x-finmind-sso-token') || req.headers.get('authorization');
    const [user, ssoState] = await Promise.all([
      requireAuthenticatedUser(),
      getActiveSsoSession(headerToken),
    ]);

    const { searchParams } = new URL(req.url);
    const requestedModelId =
      searchParams.get('modelId') ||
      user.settings?.openaiModel ||
      'gpt-4o-mini';

    const result = await executeModelSanityCheck({
      modelId: requestedModelId,
      ssoToken: ssoState.token || '',
      userKeys: {
        openaiApiKey: user.settings?.openaiApiKey,
        geminiApiKey: user.settings?.geminiApiKey,
        claudeApiKey: user.settings?.claudeApiKey,
      },
    });

    return NextResponse.json(
      {
        ok: result.passed,
        ssoAuthenticated: result.passed,
        ssoSession: ssoState.session,
        sanityCheck: result,
        error: result.error || null,
        availableModels: AI_MODELS_CATALOG.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          provider: m.provider,
          providerGroupLabel: m.providerGroupLabel,
          capabilities: m.capabilities,
        })),
      },
      { status: result.passed ? 200 : result.httpStatus || 401 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        ssoAuthenticated: false,
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}

/**
 * Handler POST /api/ai/sanity-check
 * Body: { modelId: string, persistSelection?: boolean, customPrompt?: string }
 */
export async function handleSanityCheckPost(req: NextRequest) {
  try {
    const headerToken =
      req.headers.get('x-finmind-sso-token') || req.headers.get('authorization');
    const body = await req.json().catch(() => ({}));
    const [user, ssoState] = await Promise.all([
      requireAuthenticatedUser(),
      getActiveSsoSession(headerToken),
    ]);

    const strictDescriptor = body.modelId
      ? findStrictAiModelDescriptor(body.modelId)
      : getAiModelDescriptor(user.settings?.openaiModel || 'gpt-4o-mini');

    if (!strictDescriptor) {
      const invalidModelResult = await executeModelSanityCheck({
        modelId: String(body.modelId || ''),
        ssoToken: ssoState.token || '',
        customPrompt: typeof body.customPrompt === 'string' ? body.customPrompt : undefined,
        userKeys: {
          openaiApiKey: user.settings?.openaiApiKey,
          geminiApiKey: user.settings?.geminiApiKey,
          claudeApiKey: user.settings?.claudeApiKey,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          ssoAuthenticated: false,
          ssoSession: ssoState.session,
          sanityCheck: invalidModelResult,
          error: invalidModelResult.error,
        },
        { status: 404 }
      );
    }

    if (body.persistSelection !== false) {
      await prisma.userSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          aiProvider: strictDescriptor.provider,
          openaiModel:
            strictDescriptor.provider === 'OPENAI' ? strictDescriptor.id : 'gpt-4o-mini',
          geminiModel:
            strictDescriptor.provider === 'GEMINI' ? strictDescriptor.id : 'gemini-2.0-flash',
          claudeModel:
            strictDescriptor.provider === 'CLAUDE'
              ? strictDescriptor.id
              : 'claude-3-5-sonnet-latest',
        },
        update: {
          aiProvider: strictDescriptor.provider,
          ...(strictDescriptor.provider === 'OPENAI' && { openaiModel: strictDescriptor.id }),
          ...(strictDescriptor.provider === 'GEMINI' && { geminiModel: strictDescriptor.id }),
          ...(strictDescriptor.provider === 'CLAUDE' && { claudeModel: strictDescriptor.id }),
        },
      });
    }

    const result = await executeModelSanityCheck({
      modelId: strictDescriptor.id,
      ssoToken: ssoState.token || '',
      customPrompt: typeof body.customPrompt === 'string' ? body.customPrompt : undefined,
      userKeys: {
        openaiApiKey: user.settings?.openaiApiKey,
        geminiApiKey: user.settings?.geminiApiKey,
        claudeApiKey: user.settings?.claudeApiKey,
      },
    });

    return NextResponse.json(
      {
        ok: result.passed,
        ssoAuthenticated: result.passed,
        ssoSession: ssoState.session,
        sanityCheck: result,
        error: result.error || null,
      },
      { status: result.passed ? 200 : result.httpStatus || 401 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        ssoAuthenticated: false,
        error: err instanceof Error ? err.message : 'Sessão não autenticada.',
      },
      { status: 401 }
    );
  }
}
