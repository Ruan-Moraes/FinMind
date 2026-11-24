'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormField, Input } from '@/shared/ui/input';
import { loginAction } from '@/features/auth/actions/auth-settings.actions';

export function LoginView({ defaultEmail }: { defaultEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState(defaultEmail);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('email', email);
      fd.set('password', password);
      const res = await loginAction(fd);
      if (!res.ok) {
        setError(res.error || 'Falha na autenticação.');
      } else {
        router.refresh();
      }
    } catch {
      setError('Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-zinc-900 dark:bg-zinc-50 flex items-center justify-center text-white dark:text-zinc-950 font-bold text-lg">
            FM
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">
              FinMind Pessoal
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Acesso exclusivo protegido com sessão autenticada
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 p-3 text-xs font-medium text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="E-mail de Acesso" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Senha de Acesso"
            htmlFor="login-password"
            hint="Informe sua senha cadastrada"
          >
            <Input
              id="login-password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">
            <Lock className="h-4 w-4" />
            Entrar no Painel Financeiro
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Dados salvos na nuvem • Acesso protegido e criptografado</span>
        </div>
      </div>
    </div>
  );
}
