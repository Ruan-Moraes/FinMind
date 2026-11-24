import { NextResponse } from 'next/server';
import { rejectCrossOriginWrite } from '@/shared/lib/request-origin';
import { requireAuthenticatedUser } from '@/features/auth';
import { resolveUserProviderCredentials } from '@/features/ai-copilot/services/ai-credentials-service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB efêmero em memória

async function transcribeWithOpenAiWhisper(file: File, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append('file', file, file.name || 'voice.webm');
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: form,
    });
    if (!res.ok) {
      throw new Error(`OpenAI Whisper HTTP ${res.status}`);
    }
    const data = (await res.json()) as { text?: string };
    return String(data.text || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

async function transcribeWithGeminiAudio(file: File, apiKey: string, model: string): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString('base64');
  const mimeType = file.type && file.type.startsWith('audio/') ? file.type.split(';')[0] : 'audio/webm';
  const upstreamModel = model.startsWith('gemini-') ? model : 'gemini-2.0-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(upstreamModel)}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: 'Transcreva fielmente em português (pt-BR) exatamente o que foi falado neste áudio. Retorne APENAS o texto transcrito, sem comentários, preservando números e valores monetários.',
              },
              { inlineData: { mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini Audio HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return String(data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser();
  } catch {
    return NextResponse.json({ ok: false, error: 'Autenticação obrigatória.' }, { status: 401 });
  }

  const blockedOrigin = rejectCrossOriginWrite(request);
  if (blockedOrigin) return blockedOrigin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Envio de áudio inválido.' }, { status: 400 });
  }

  const audio = formData.get('audio');
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: 'Nenhum áudio válido recebido.' }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: 'O áudio excede o limite máximo de 10 MB.' }, { status: 413 });
  }
  if (audio.type && !audio.type.startsWith('audio/')) {
    return NextResponse.json({ ok: false, error: 'Formato de arquivo não suportado (esperado audio/*).' }, { status: 400 });
  }

  const bundle = await resolveUserProviderCredentials(user.id);
  const openaiKey = bundle.providers.OPENAI.effectiveKey;
  const geminiKey = bundle.providers.GEMINI.effectiveKey;
  const preferred = bundle.activeProvider;

  const hasOpenAi = Boolean(openaiKey);
  const hasGemini = Boolean(geminiKey);

  if (!hasOpenAi && !hasGemini) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Este navegador não suporta transcrição local ao vivo e nenhuma chave OpenAI ou Gemini está configurada para transcrição de áudio na nuvem.',
      },
      { status: 422 }
    );
  }

  try {
    let transcript = '';
    let providerUsed = '';
    const geminiModel = bundle.providers.GEMINI.selectedModelId || 'gemini-2.0-flash';

    if (preferred === 'GEMINI' && hasGemini) {
      transcript = await transcribeWithGeminiAudio(audio, geminiKey, geminiModel);
      providerUsed = 'Google Gemini Audio';
    } else if (hasOpenAi) {
      transcript = await transcribeWithOpenAiWhisper(audio, openaiKey);
      providerUsed = 'OpenAI Whisper';
    } else if (hasGemini) {
      transcript = await transcribeWithGeminiAudio(audio, geminiKey, geminiModel);
      providerUsed = 'Google Gemini Audio';
    }

    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: 'Não foi possível identificar fala clara no áudio capturado.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, transcript, providerUsed });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'O provedor não conseguiu transcrever o áudio. Verifique a conexão de IA e tente novamente.' },
      { status: 502 }
    );
  }
}
