import bcrypt from 'bcryptjs';
import { prisma } from '@/shared/lib/prisma';
import { getSession, isSessionExplicitlyLoggedOut } from '@/features/auth/services/session-cookies';
import { isPublicAuthRequired, isStrongAdminPassword } from '@/features/auth/domain/access-policy';
import type { SessionPayload } from '@/features/auth/domain/jwt-session';
import { decryptSecret } from '@/features/auth/domain/secret-crypto';

const LEGACY_SIMULATED_TOKEN_PREFIX = 'sso_popup_token::';

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
  const publicAuth = isPublicAuthRequired();
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (publicAuth && (!configuredEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail))) {
    throw new Error('Configure ADMIN_EMAIL para a conta do FinMind.');
  }
  const adminEmail = configuredEmail || 'admin@finmind.app';
  const adminName = process.env.ADMIN_NAME || 'Administrador FinMind';

  let user = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { settings: true },
  });

  if (!user) {
    const adminPass = process.env.ADMIN_PASSWORD || (publicAuth ? '' : 'admin123');
    if (publicAuth && !isStrongAdminPassword(adminPass)) {
      throw new Error('Configure ADMIN_PASSWORD com uma senha de pelo menos 16 caracteres e até 72 bytes.');
    }
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
            aiConnectionMode: 'API_KEY',
            openaiModel: '',
            geminiModel: '',
            claudeModel: '',
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
        aiConnectionMode: 'API_KEY',
        openaiModel: '',
        geminiModel: '',
        claudeModel: '',
      },
    });
    user = { ...user, settings };
  } else {
    // Higieniza eventuais tokens legados simulados sem sobrescrever modelos reais escolhidos
    const s = user.settings;
    const cleanOpenaiKey = s.openaiApiKey?.startsWith(LEGACY_SIMULATED_TOKEN_PREFIX) ? null : s.openaiApiKey;
    const cleanGeminiKey = s.geminiApiKey?.startsWith(LEGACY_SIMULATED_TOKEN_PREFIX) ? null : s.geminiApiKey;
    const cleanClaudeKey = s.claudeApiKey?.startsWith(LEGACY_SIMULATED_TOKEN_PREFIX) ? null : s.claudeApiKey;

    if (
      cleanOpenaiKey !== s.openaiApiKey ||
      cleanGeminiKey !== s.geminiApiKey ||
      cleanClaudeKey !== s.claudeApiKey ||
      s.aiConnectionMode !== 'API_KEY'
    ) {
      const updatedSettings = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          aiConnectionMode: 'API_KEY',
          openaiApiKey: cleanOpenaiKey,
          geminiApiKey: cleanGeminiKey,
          claudeApiKey: cleanClaudeKey,
        },
      });
      user = { ...user, settings: updatedSettings };
    }
  }

  return withDecryptedSettings(user);
}

export async function findSessionUser(session: SessionPayload | null) {
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { settings: true },
  });
  return user ? withDecryptedSettings(user) : null;
}

/**
 * Resolve o usuário autenticado da sessão ativa e bloqueia acesso após logout.
 */
export async function requireAuthenticatedUser() {

  const loggedOut = await isSessionExplicitlyLoggedOut();
  if (loggedOut) {
    throw new Error('Sessão encerrada. Faça login novamente para acessar seus dados financeiros.');
  }

  const user = await findSessionUser(await getSession());
  if (user) return user;

  if (isPublicAuthRequired()) {
    throw new Error('Autenticação obrigatória. Faça login para acessar seus dados financeiros.');
  }

  return ensurePersonalUserInitialized();
}
