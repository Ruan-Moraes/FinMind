import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/features/auth';
import {
  buildUserFinancialBackup,
  buildUserTransactionsCsv,
} from '@/features/transactions/services/export-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Acesso não autorizado.';
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'csv').toLowerCase().trim();

  if (format === 'csv') {
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const month = monthParam ? Number(monthParam) : undefined;
    const year = yearParam ? Number(yearParam) : undefined;

    const { csv, filename } = await buildUserTransactionsCsv(user.id, { month, year });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'json') {
    const { payload, filename } = await buildUserFinancialBackup(user.id);

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json(
    { ok: false, error: 'Formato inválido. Use format=csv ou format=json.' },
    { status: 400 }
  );
}
