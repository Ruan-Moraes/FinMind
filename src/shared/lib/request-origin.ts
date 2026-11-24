import { NextResponse } from 'next/server';

export function rejectCrossOriginWrite(request: Request) {
  const origin = request.headers.get('origin');
  if (
    request.headers.get('sec-fetch-site') === 'cross-site' ||
    (origin !== null && origin !== new URL(request.url).origin)
  ) {
    return NextResponse.json({ ok: false, error: 'Origem da requisição inválida.' }, { status: 403 });
  }
  return null;
}
