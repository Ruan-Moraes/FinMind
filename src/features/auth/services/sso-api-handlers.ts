import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import { decryptSecret, encryptSecret } from '@/features/auth/domain/secret-crypto';
import { prisma } from '@/shared/lib/prisma';
import { getActiveSsoSession, issueSsoSessionCookie, revokeSsoSessionCookie, type SsoIdentityProvider } from '@/features/auth/sso';
import { getAiModelDescriptor, isAuthenticApiKey, maskApiKey, type AiProviderId } from '@/features/ai-copilot/models';
import { executeModelSanityCheck } from '@/features/ai-copilot/providers';
import { fetchLiveGeminiModels } from '@/features/ai-copilot/providers/gemini-models-discovery';

function resolveProviderAuthState(
  dbKey: string | null | undefined,
  envKey: string | undefined,
  envLabel: string
): {
  authenticated: boolean;
  method: 'API_KEY' | 'ENV_KEY' | 'NONE';
  email: string | null;
  maskedKey: string | null;
} {
  if (isAuthenticApiKey(dbKey)) {
    const masked = maskApiKey(dbKey);
    return { authenticated: true, method: 'API_KEY', email: masked, maskedKey: masked };
  }
  if (isAuthenticApiKey(envKey)) {
    return {
      authenticated: true,
      method: 'ENV_KEY',
      email: `${envLabel} (Ambiente)`,
      maskedKey: maskApiKey(envKey),
    };
  }
  return { authenticated: false, method: 'NONE', email: null, maskedKey: null };
}

export async function handleSsoStatusGet(req: NextRequest) {
  try {
    const headerToken = req.headers.get('x-finmind-sso-token') || req.headers.get('authorization');
    const [user, ssoState] = await Promise.all([
      requireAuthenticatedUser(),
      getActiveSsoSession(headerToken),
    ]);
    const configuredProviders: Record<
      AiProviderId,
      ReturnType<typeof resolveProviderAuthState>
    > = {
      OPENAI: resolveProviderAuthState(
        user.settings?.openaiApiKey,
        process.env.OPENAI_API_KEY,
        'OPENAI_API_KEY'
      ),
      GEMINI: resolveProviderAuthState(
        user.settings?.geminiApiKey,
        process.env.GEMINI_API_KEY,
        'GEMINI_API_KEY'
      ),
      CLAUDE: resolveProviderAuthState(
        user.settings?.claudeApiKey,
        process.env.ANTHROPIC_API_KEY,
        'ANTHROPIC_API_KEY'
      ),
    };
    const anyProviderConfigured =
      configuredProviders.OPENAI.authenticated ||
      configuredProviders.GEMINI.authenticated ||
      configuredProviders.CLAUDE.authenticated;
    return NextResponse.json({
      ok: true, authenticated: ssoState.authenticated && anyProviderConfigured,
      session: ssoState.session, configuredProviders,
      tokenPreview: ssoState.token
        ? `${ssoState.token.slice(0, 18)}...${ssoState.token.slice(-10)}`
        : null, error: ssoState.error || null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false, authenticated: false,
        error: err instanceof Error ? err.message : 'Sessão não autenticada.', },
      { status: 401 }
    );
  }
}
export async function handleSsoAuthenticateOrRevokePost(req: NextRequest) {
  try { const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'authenticate');
    const user = await requireAuthenticatedUser();
    if (action === 'revoke') { const providerToClear = body.provider as AiProviderId | undefined;
      if (providerToClear) {
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: {
            ...(providerToClear === 'OPENAI' && { openaiApiKey: '' }),
            ...(providerToClear === 'GEMINI' && { geminiApiKey: '' }),
            ...(providerToClear === 'CLAUDE' && { claudeApiKey: '' }),
          }, });
      } else {
        await prisma.userSettings.update({
          where: { userId: user.id },
          data: {
            openaiApiKey: '', geminiApiKey: '',
            claudeApiKey: '', },
        });
        await revokeSsoSessionCookie();
      }
      return NextResponse.json({
        ok: true, authenticated: false,
        session: null, message: providerToClear
          ? `Credencial de ${providerToClear} removida com sucesso.`
          : 'Todas as credenciais de IA e sessões foram encerradas.', });
    }
    if (action === 'popup_login' && !isAuthenticApiKey(body.apiKey)) {
      return NextResponse.json(
        {
          ok: false, authenticated: false,
          diagnosticCode: 'MISSING_CREDENTIALS', error:
            'Login simulado por e-mail/senha desativado por política de autenticidade. Informe uma chave de API oficial válida do provedor.',
        },
        { status: 401 }
      );
    }
    const descriptor = getAiModelDescriptor(
      body.modelId || user.settings?.openaiModel || 'gpt-4o-mini'
    );
    const targetProvider: AiProviderId =
      (body.provider as AiProviderId) || descriptor.provider;
    const idpProvider: SsoIdentityProvider =
      (body.idpProvider as SsoIdentityProvider) ||
      (targetProvider === 'OPENAI'
        ? 'OPENAI_SSO'
        : targetProvider === 'GEMINI'
        ? 'GOOGLE_WORKSPACE_SSO'
        : 'ANTHROPIC_SSO');
    const providedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (providedKey.length > 0 && !isAuthenticApiKey(providedKey)) {
      return NextResponse.json(
        {
          ok: false, authenticated: false,
          diagnosticCode: 'INVALID_CREDENTIALS',
          error: `Formato de chave de API inválido para ${descriptor.providerGroupLabel}.`,
        },
        { status: 400 }
      );
    }
    let effectiveDescriptor = descriptor;
    if (body.verifyConnectionLive && isAuthenticApiKey(providedKey)) {
      let liveCheck = await executeModelSanityCheck({
        modelId: effectiveDescriptor.id,
        userKeys: {
          openaiApiKey: targetProvider === 'OPENAI' ? providedKey : user.settings?.openaiApiKey,
          geminiApiKey: targetProvider === 'GEMINI' ? providedKey : user.settings?.geminiApiKey,
          claudeApiKey: targetProvider === 'CLAUDE' ? providedKey : user.settings?.claudeApiKey,
        },
      });
      // Se o modelo Gemini padrão estiver descontinuado na conta, descobre automaticamente um modelo ativo da Google
      if (!liveCheck.passed && targetProvider === 'GEMINI' && liveCheck.diagnosticCode === 'MODEL_UNAVAILABLE') {
        const discovered = await fetchLiveGeminiModels(providedKey);
        if (discovered.ok && discovered.models.length > 0) {
          effectiveDescriptor = discovered.models[0];
          liveCheck = await executeModelSanityCheck({
            modelId: effectiveDescriptor.id,
            userKeys: {
              openaiApiKey: user.settings?.openaiApiKey,
              geminiApiKey: providedKey,
              claudeApiKey: user.settings?.claudeApiKey,
            },
          });
        }
      }
      if (!liveCheck.passed) {
        return NextResponse.json(
          {
            ok: false,
            authenticated: false,
            diagnosticCode: liveCheck.diagnosticCode,
            sanityCheck: liveCheck,
            error:
              liveCheck.error ||
              `A chave informada foi recusada por ${effectiveDescriptor.providerGroupLabel} (HTTP ${liveCheck.httpStatus}).`,
          },
          { status: liveCheck.httpStatus || 401 }
        );
      }
    }
    if (isAuthenticApiKey(providedKey)) {
      const encryptedKey = encryptSecret(providedKey);
      const providerKeyUpdate =
        targetProvider === 'OPENAI'
          ? { openaiApiKey: encryptedKey, openaiModel: effectiveDescriptor.id }
          : targetProvider === 'GEMINI'
          ? { geminiApiKey: encryptedKey, geminiModel: effectiveDescriptor.id }
          : { claudeApiKey: encryptedKey, claudeModel: effectiveDescriptor.id };
      await prisma.userSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          aiProvider: targetProvider,
          aiConnectionMode: 'API_QUOTA',
          openaiApiKey: '',
          geminiApiKey: '',
          claudeApiKey: '',
          ...providerKeyUpdate,
        },
        update: { aiProvider: targetProvider, aiConnectionMode: 'API_QUOTA', ...providerKeyUpdate },
      });
    }
    const updatedSettings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });
    const effectiveKey =
      targetProvider === 'OPENAI'
        ? decryptSecret(updatedSettings?.openaiApiKey) || process.env.OPENAI_API_KEY?.trim() || ''
        : targetProvider === 'GEMINI'
        ? decryptSecret(updatedSettings?.geminiApiKey) || process.env.GEMINI_API_KEY?.trim() || ''
        : decryptSecret(updatedSettings?.claudeApiKey) || process.env.ANTHROPIC_API_KEY?.trim() || '';
    if (!isAuthenticApiKey(effectiveKey)) {
      return NextResponse.json(
        {
          ok: false, authenticated: false,
          diagnosticCode: 'MISSING_CREDENTIALS', session: null,
          error: `Nenhuma chave de API oficial configurada para ${descriptor.providerGroupLabel}. Configure sua chave (${descriptor.envVarName}) para autenticar.`,
        },
        { status: 401 }
      );
    }
    const { token, session } = await issueSsoSessionCookie({
      userId: user.id, email: user.email,
      name: user.name, idpProvider,
    });
    return NextResponse.json({
      ok: true, authenticated: true,
      provider: targetProvider, modelId: effectiveDescriptor.id, maskedKey: maskApiKey(effectiveKey),
      session,
      tokenPreview: `${token.slice(0, 18)}...${token.slice(-10)}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false, authenticated: false,
        error: err instanceof Error ? err.message : 'Erro ao processar autenticação de IA.', },
      { status: 401 }
    );
  }
}