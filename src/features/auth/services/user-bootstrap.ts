import bcrypt from 'bcryptjs';
import { prisma } from '@/shared/lib/prisma';
import {
  DEFAULT_AI_MODEL_ID,
  getAiModelDescriptor,
  SSO_POPUP_TOKEN_PREFIX,
} from '@/features/ai-copilot/models';
import { getSession, isSessionExplicitlyLoggedOut } from '@/features/auth/services/session-cookies';
import { isPublicAuthRequired } from '@/features/auth/domain/access-policy';
import { decryptSecret } from '@/features/auth/domain/secret-crypto';

function withDecryptedSettings<
  T extends {
    settings: {
      openaiApiKey: string | null;
      geminiApiKey: string | null;
      claudeApiKey: string | null;
    } | null;
  }
>(user: T): T {
  if (!user.settings) return user;
  return {
    ...user,
    settings: {
      ...user.settings,
      openaiApiKey: decryptSecret(user.settings.openaiApiKey) || null,
      geminiApiKey: decryptSecret(user.settings.geminiApiKey) || null,
      claudeApiKey: decryptSecret(user.settings.claudeApiKey) || null,
    },
  };
}

/**
 * Inicializa a estrutura base do usuário e higieniza eventuais configurações legadas/simuladas.
 */
export async function ensurePersonalUserInitialized() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@finmind.app').toLowerCase().trim();
  const adminName = process.env.ADMIN_NAME || 'Administrador FinMind';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  let user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { settings: true },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(adminPass, 10);
    user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        settings: {
          create: {
            theme: 'DARK',
            density: 'COMFORTABLE',
            hideValuesByDefault: false,
            fiscalMonthStartDay: 1,
            aiProvider: 'OPENAI',
            aiConnectionMode: 'API_QUOTA',
            openaiModel: DEFAULT_AI_MODEL_ID,
            geminiModel: 'gemini-2.0-flash',
            claudeModel: 'claude-3-5-sonnet-latest',
          },
        },
      },
      include: { settings: true },
    });
  } else if (!user.settings) {
    const settings = await prisma.userSettings.create({
      data: {
        userId: user.id,
        theme: 'DARK',
        density: 'COMFORTABLE',
        hideValuesByDefault: false,
        fiscalMonthStartDay: 1,
        aiProvider: 'OPENAI',
        aiConnectionMode: 'API_QUOTA',
        openaiModel: DEFAULT_AI_MODEL_ID,
        geminiModel: 'gemini-2.0-flash',
        claudeModel: 'claude-3-5-sonnet-latest',
      },
    });
    user = { ...user, settings };
  } else {
    // Higieniza tokens de pop-up simulados legados e migra IDs de modelos fictícios para modelos reais
    const s = user.settings;
    const cleanOpenaiKey = s.openaiApiKey?.startsWith(SSO_POPUP_TOKEN_PREFIX)
      ? ''
      : s.openaiApiKey;
    const cleanGeminiKey = s.geminiApiKey?.startsWith(SSO_POPUP_TOKEN_PREFIX)
      ? ''
      : s.geminiApiKey;
    const cleanClaudeKey = s.claudeApiKey?.startsWith(SSO_POPUP_TOKEN_PREFIX)
      ? ''
      : s.claudeApiKey;

    const realOpenaiModel = getAiModelDescriptor(s.openaiModel).id;
    const realGeminiModel = getAiModelDescriptor(s.geminiModel).id;
    const realClaudeModel = getAiModelDescriptor(s.claudeModel).id;

    if (
      cleanOpenaiKey !== s.openaiApiKey ||
      cleanGeminiKey !== s.geminiApiKey ||
      cleanClaudeKey !== s.claudeApiKey ||
      realOpenaiModel !== s.openaiModel ||
      realGeminiModel !== s.geminiModel ||
      realClaudeModel !== s.claudeModel
    ) {
      const updatedSettings = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          openaiApiKey: cleanOpenaiKey,
          geminiApiKey: cleanGeminiKey,
          claudeApiKey: cleanClaudeKey,
          openaiModel: realOpenaiModel,
          geminiModel: realGeminiModel,
          claudeModel: realClaudeModel,
        },
      });
      user = { ...user, settings: updatedSettings };
    }
  }

  return withDecryptedSettings(user);
}

/**
 * Resolve o usuário autenticado da sessão ativa (garantindo isolamento por userId e bloqueio após logout).
 */
export async function requireAuthenticatedUser(explicitUserId?: string) {
  if (explicitUserId) {
    const found = await prisma.user.findUnique({
      where: { id: explicitUserId },
      include: { settings: true },
    });
    if (found) return withDecryptedSettings(found);
  }

  const loggedOut = await isSessionExplicitlyLoggedOut();
  if (loggedOut) {
    throw new Error('Sessão encerrada. Faça login novamente para acessar seus dados financeiros.');
  }

  const session = await getSession();
  if (session?.userId) {
    const sessionUser = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { settings: true },
    });
    if (sessionUser) {
      return withDecryptedSettings(sessionUser);
    }
  }

  if (isPublicAuthRequired()) {
    throw new Error('Autenticação obrigatória. Faça login para acessar seus dados financeiros.');
  }

  return ensurePersonalUserInitialized();
}
