import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl && tursoUrl.length > 0) {
    const adapter = new PrismaLibSQL({
      url: tursoUrl,
      authToken: tursoAuthToken || undefined,
    });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

function isPrismaClientCurrent(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const delegates = client as unknown as Record<string, unknown>;
  return Boolean(
    delegates.systemKnowledgeDocument &&
      delegates.systemKnowledgeChunk &&
      delegates.agentActionAuditLog &&
      delegates.holiday
  );
}

export const prisma = isPrismaClientCurrent(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
