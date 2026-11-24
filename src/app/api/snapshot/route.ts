import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAuthenticatedUser } from '@/features/auth';
import { exportUserSnapshot } from '@/features/dashboard/services/snapshot-export';
import { importUserSnapshot } from '@/features/dashboard/services/snapshot-import';

export const dynamic = 'force-dynamic';

export async function GET() {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sessão não autenticada.';
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  const { json, filename } = await exportUserSnapshot(user.id);
  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sessão não autenticada.';
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Não foi possível ler o arquivo. Envie um snapshot válido.' },
      { status: 400 }
    );
  }

  const result = await importUserSnapshot(user.id, payload);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  revalidatePath('/');
  return NextResponse.json(result, { status: 200 });
}
