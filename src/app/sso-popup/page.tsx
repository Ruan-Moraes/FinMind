'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, KeyRound, Sparkles, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { AI_MODELS_CATALOG, getAiModelDescriptor, type AiProviderId } from '@/features/ai-copilot/models';
import { ProviderBrandIcon, PROVIDER_BRANDING } from '@/features/auth/components/sso-provider-branding';
import { GeminiPopupModelPicker } from '@/features/ai-copilot/components/gemini-popup-model-picker';
function SsoPopupContent() { const searchParams = useSearchParams();
  const rawProvider = (searchParams.get('provider') || 'OPENAI').toUpperCase() as AiProviderId;
  const provider: AiProviderId =
    rawProvider === 'GEMINI' || rawProvider === 'CLAUDE' ? rawProvider : 'OPENAI';
  const requestedModelId = searchParams.get('modelId') || '';
  const brand = PROVIDER_BRANDING[provider];
  const providerModels = AI_MODELS_CATALOG.filter((m) => m.provider === provider);
  const initialDescriptor = requestedModelId
    ? getAiModelDescriptor(requestedModelId)
    : providerModels[0];
  const [selectedModelId, setSelectedModelId] = React.useState(
    initialDescriptor.provider === provider ? initialDescriptor.id : providerModels[0].id
  );
  const selectedDescriptor = getAiModelDescriptor(selectedModelId);
  const [step, setStep] = React.useState<'INPUT_KEY' | 'SUCCESS'>('INPUT_KEY');
  const [apiKey, setApiKey] = React.useState('');
  const [verifyLiveOnSave, setVerifyLiveOnSave] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [diagnosticCode, setDiagnosticCode] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  React.useEffect(() => {
    const syncThemeWithOpener = () => {
      try {
        const themeParam = searchParams.get('theme');
        if (themeParam === 'LIGHT') { document.documentElement.classList.remove('dark'); return; }
        if (themeParam === 'DARK') { document.documentElement.classList.add('dark'); return; }
        if (window.opener?.document) {
          document.documentElement.classList.toggle('dark', window.opener.document.documentElement.classList.contains('dark'));
        }
      } catch {}
    };
    syncThemeWithOpener();
    const interval = setInterval(syncThemeWithOpener, 500);
    return () => clearInterval(interval);
  }, [searchParams]);
  const handleSaveAndVerifyKey = async (e: React.FormEvent) => { e.preventDefault();
    setError(null);
    setDiagnosticCode(null);
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length <= 8) {
      setError(`Informe uma chave de API oficial válida (${selectedDescriptor.envVarName}).`);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'authenticate', provider,
          modelId: selectedDescriptor.id, apiKey: trimmedKey,
          verifyConnectionLive: verifyLiveOnSave, }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setDiagnosticCode(data.diagnosticCode || null);
        setError(
          data.error ||
            `A conexão real com ${brand.name} falhou. Verifique sua chave de API e seu saldo/cota.`
        );
        return;
      }
      setStep('SUCCESS');
      if (typeof window !== 'undefined' && window.opener) {
        window.opener.postMessage(
          {
            type: 'FINMIND_SSO_POPUP_SUCCESS', provider,
            modelId: data.modelId || selectedDescriptor.id, email: data.maskedKey || selectedDescriptor.envVarName,
          }, window.location.origin
        );
      }
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { window.close(); }, 900);
    } catch { setError('Falha de comunicação ao testar e salvar a credencial no FinMind.');
    } finally { setIsSubmitting(false);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col justify-between p-5 sm:p-6 transition-colors">
      {/* Top Bar */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shadow-sm">
            FM
          </div>
          <div className="text-xs">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">
              FinMind
            </span>
            <span className="text-slate-400 dark:text-zinc-500 mx-1.5">•</span>
            <span className="text-slate-500 dark:text-zinc-400">Conector Oficial de API</span>
          </div>
        </div>
        <a href={brand.officialKeyPortalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 text-[11px] font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
        >
          <span>Obter Chave Oficial</span>
          <ExternalLink className="h-3 w-3 text-slate-400 dark:text-zinc-400" />
        </a>
      </div>
      {/* Card Central */}
      <div className="w-full max-w-md mx-auto my-auto py-4">
        <div className="rounded-3xl border border-slate-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900/85 p-6 shadow-xl dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/5 space-y-5 transition-colors">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div
              className={`h-14 w-14 rounded-2xl border flex items-center justify-center shadow-md ${brand.iconBoxClass}`}
            >
              <ProviderBrandIcon provider={provider} />
            </div>
            <div className="space-y-1">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${brand.badgeClass}`}
              >
                {brand.planLabel}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white pt-1">
                {brand.portalTitle}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                {brand.subtitle}
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-3 text-xs font-medium text-rose-700 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Falha na Verificação Real
                  {diagnosticCode ? ` (${diagnosticCode})` : ''}
                </span>
              </div>
              <p className="leading-relaxed">{error}</p>
            </div>
          )}
          {step === 'INPUT_KEY' && (
            <form onSubmit={handleSaveAndVerifyKey} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                  Chave de API Oficial ({selectedDescriptor.envVarName})
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="h-4 w-4 text-slate-400 dark:text-zinc-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    autoFocus placeholder={selectedDescriptor.keyPlaceholder}
                    value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    className={`w-full h-11 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950 pl-10 pr-3.5 text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all ${brand.accentRing}`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Sua chave fica protegida e criptografada na sua conta para conexão direta e segura com{' '}
                  <code className="text-slate-700 dark:text-zinc-300 font-semibold">
                    {brand.domainHint}
                  </code>
                  .
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/80 p-3 space-y-2 text-xs">
                {provider === 'GEMINI' ? (
                  <GeminiPopupModelPicker
                    apiKey={apiKey}
                    selectedModelId={selectedModelId}
                    fallbackModels={providerModels}
                    onSelectModel={setSelectedModelId}
                  />
                ) : (
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-900 dark:text-zinc-100 block">Modelos Disponíveis:</strong>
                      <span className="text-slate-500 dark:text-zinc-400 text-[11px]">
                        {providerModels.map((m) => m.displayName).join(' • ')}
                      </span>
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 pt-1.5 border-t border-slate-200/70 dark:border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox" checked={verifyLiveOnSave}
                    onChange={(e) => setVerifyLiveOnSave(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-600 dark:text-zinc-300">
                    Testar conexão com {selectedDescriptor.displayName} antes de salvar
                  </span>
                </label>
              </div>
              <button
                type="submit" disabled={isSubmitting}
                className={`w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${brand.buttonClass}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validando Chave na API Oficial...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Validar e Salvar Chave {brand.shortName}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
          {step === 'SUCCESS' && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2.5">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {brand.name} Configurado!
              </h2>
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Chave validada e vinculada ao FinMind. Esta janela será fechada automaticamente...
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Rodapé */}
      <div className="w-full max-w-md mx-auto border-t border-slate-200 dark:border-zinc-900 pt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-slate-400 dark:text-zinc-400" />
          Credencial isolada por provedor • Sem simulações
        </span>
        <span className="font-mono">{provider}</span>
      </div>
    </div>
  );
}
export default function SsoPopupPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-[#09090b]" />}>
      <SsoPopupContent />
    </React.Suspense>
  );
}
