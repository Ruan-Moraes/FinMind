'use client';

import * as React from 'react';
import {
  getSpeechRecognitionCtor,
  joinTranscriptText,
  mapSpeechErrorToPtBr,
  type BrowserSpeechRecognition,
} from '@/features/ai-voice/domain/web-speech-helpers';

export type VoiceCaptureStatus = 'idle' | 'listening' | 'paused' | 'transcribing' | 'error';

export function useVoiceInput(params: {
  value: string;
  onChange: (next: string) => void;
  onTranscriptFinalized: (fullText: string) => void;
}) {
  const { value, onChange, onTranscriptFinalized } = params;
  const [status, setStatus] = React.useState<VoiceCaptureStatus>('idle');
  const [interimText, setInterimText] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [engineMode, setEngineMode] = React.useState<'webspeech' | 'recorder'>('webspeech');

  const recognitionRef = React.useRef<BrowserSpeechRecognition | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const baseTextRef = React.useRef<string>('');
  const sessionFinalRef = React.useRef<string>('');
  const snapshotBeforeVoiceRef = React.useRef<string>('');
  const statusRef = React.useRef<VoiceCaptureStatus>('idle');
  const valueRef = React.useRef<string>(value);
  valueRef.current = value;
  statusRef.current = status;

  const stopMediaTracks = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      try { recognitionRef.current?.abort(); } catch { /* noop */ }
      try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch { /* noop */ }
      stopMediaTracks();
    };
  }, [stopMediaTracks]);

  const startWebSpeech = React.useCallback((isResume: boolean) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return false;
    setEngineMode('webspeech');
    setErrorMessage(null);
    if (!isResume) {
      snapshotBeforeVoiceRef.current = valueRef.current;
    }
    baseTextRef.current = valueRef.current;
    sessionFinalRef.current = '';
    setInterimText('');

    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let newlyFinal = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const piece = res[0]?.transcript || '';
        if (res.isFinal) newlyFinal += piece;
        else interim += piece;
      }
      if (newlyFinal) {
        sessionFinalRef.current = joinTranscriptText(sessionFinalRef.current, newlyFinal);
        const merged = joinTranscriptText(baseTextRef.current, sessionFinalRef.current);
        onChange(merged);
      }
      setInterimText(interim.trim());
    };

    rec.onerror = (event) => {
      const msg = mapSpeechErrorToPtBr(event.error || 'unknown');
      if (!msg) return;
      setErrorMessage(msg);
      setStatus('error');
    };

    rec.onend = () => {
      if (statusRef.current === 'listening') {
        baseTextRef.current = valueRef.current;
        sessionFinalRef.current = '';
        try { rec.start(); } catch { setStatus('paused'); }
      }
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setStatus('listening');
      return true;
    } catch {
      setErrorMessage('Não foi possível iniciar o microfone.');
      setStatus('error');
      return true;
    }
  }, [onChange]);

  const startMediaRecorderFallback = React.useCallback(async (isResume: boolean) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Seu navegador não suporta captura de áudio ou reconhecimento de voz.');
      setStatus('error');
      return;
    }
    setEngineMode('recorder');
    setErrorMessage(null);
    if (!isResume) snapshotBeforeVoiceRef.current = valueRef.current;
    baseTextRef.current = valueRef.current;
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = recorder;
      recorder.start(400);
      setStatus('listening');
    } catch {
      setErrorMessage('Permissão de microfone negada ou dispositivo indisponível.');
      setStatus('error');
    }
  }, []);

  const startCapture = React.useCallback(() => {
    if (!startWebSpeech(false)) void startMediaRecorderFallback(false);
  }, [startMediaRecorderFallback, startWebSpeech]);

  const pauseCapture = React.useCallback(() => {
    if (statusRef.current !== 'listening') return;
    setStatus('paused');
    if (engineMode === 'webspeech') {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      if (interimText) {
        const merged = joinTranscriptText(valueRef.current, interimText);
        onChange(merged);
        setInterimText('');
      }
    } else if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
    }
  }, [engineMode, interimText, onChange]);

  const resumeCapture = React.useCallback(() => {
    if (statusRef.current !== 'paused') return;
    if (engineMode === 'webspeech') {
      startWebSpeech(true);
    } else if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setStatus('listening');
    }
  }, [engineMode, startWebSpeech]);

  const cancelCapture = React.useCallback(() => {
    setStatus('idle');
    setInterimText('');
    setErrorMessage(null);
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      try { recorderRef.current.stop(); } catch { /* noop */ }
    }
    stopMediaTracks();
    onChange(snapshotBeforeVoiceRef.current);
  }, [onChange, stopMediaTracks]);

  const finishCapture = React.useCallback(() => {
    if (engineMode === 'webspeech') {
      setStatus('idle');
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      const finalCombined = joinTranscriptText(valueRef.current, interimText);
      setInterimText('');
      onChange(finalCombined);
      if (finalCombined.trim()) onTranscriptFinalized(finalCombined.trim());
      return;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setStatus('idle');
      stopMediaTracks();
      return;
    }

    setStatus('transcribing');
    recorder.onstop = async () => {
      stopMediaTracks();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      chunksRef.current = [];
      if (blob.size === 0) {
        setStatus('idle');
        return;
      }
      try {
        const form = new FormData();
        form.append('audio', blob, 'voice-input.webm');
        const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form });
        const data = (await res.json()) as { ok?: boolean; transcript?: string; error?: string };
        if (!res.ok || !data.ok || !data.transcript) {
          setErrorMessage(data.error || 'Não foi possível transcrever o áudio capturado.');
          setStatus('error');
          return;
        }
        const merged = joinTranscriptText(baseTextRef.current, data.transcript);
        onChange(merged);
        setStatus('idle');
        onTranscriptFinalized(merged.trim());
      } catch {
        setErrorMessage('Erro de rede ao enviar áudio para transcrição.');
        setStatus('error');
      }
    };
    recorder.stop();
  }, [engineMode, interimText, onChange, onTranscriptFinalized, stopMediaTracks]);

  return {
    status,
    interimText,
    errorMessage,
    engineMode,
    clearError: () => { setErrorMessage(null); if (status === 'error') setStatus('idle'); },
    startCapture,
    pauseCapture,
    resumeCapture,
    finishCapture,
    cancelCapture,
  };
}
