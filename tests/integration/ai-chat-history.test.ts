import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';

describe('Integração: Persistência do Histórico de Conversas da IA', () => {
  const email = `chat-history-${Date.now()}@finmind.local`;
  let userId = '';

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('cria sessão de conversa, persiste mensagens estruturadas e remove em cascata', async () => {
    const user = await prisma.user.create({
      data: { email, name: 'Teste Chat', passwordHash: 'hash' },
    });
    userId = user.id;

    const session = await prisma.aiChatSession.create({
      data: { userId, title: 'Análise de Gastos de Novembro' },
    });

    await prisma.aiChatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'user', content: 'Mostre meus maiores gastos' },
        {
          sessionId: session.id,
          role: 'assistant',
          content: 'Seu maior gasto foi Alimentação.',
          responseJson: JSON.stringify({ directAnswer: 'Seu maior gasto foi Alimentação.', charts: [] }),
        },
      ],
    });

    const loaded = await prisma.aiChatSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[1].responseJson).toContain('Alimentação');

    await prisma.aiChatSession.delete({ where: { id: session.id } });
    const remainingMsgs = await prisma.aiChatMessage.count({ where: { sessionId: session.id } });
    expect(remainingMsgs).toBe(0);
  });
});
