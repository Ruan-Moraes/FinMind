export interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

export interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechCtor = new () => BrowserSpeechRecognition;

export function getSpeechRecognitionCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function joinTranscriptText(base: string, segment: string): string {
  const left = base.trimEnd();
  const right = segment.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

export function mapSpeechErrorToPtBr(code: string): string | null {
  if (code === 'aborted' || code === 'no-speech') return null;
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Permissão de microfone negada. Autorize o microfone no navegador para ditar sua solicitação.';
  }
  if (code === 'audio-capture') {
    return 'Nenhum microfone ativo foi detectado neste dispositivo.';
  }
  if (code === 'network') {
    return 'Erro de rede no reconhecimento de voz. Verifique sua conexão.';
  }
  return `Erro no reconhecimento de voz (${code}).`;
}
