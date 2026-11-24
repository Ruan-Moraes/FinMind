'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { FormField, Input } from '@/shared/ui/input';
import { loginAction, registerOwnerAction } from '@/features/auth/actions/credentials.actions';

interface LoginViewProps {
  defaultEmail: string;
  registrationOpen?: boolean;
  registering?: boolean;
}

export function LoginView({ defaultEmail, registrationOpen, registering }: LoginViewProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    setError('');
    setLoading(true);
    try {
      const result = await (registering ? registerOwnerAction : loginAction)(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (registering) router.replace('/');
      router.refresh();
    } catch {
      setError('Não foi possível concluir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <div aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-900 font-bold text-white dark:bg-zinc-50 dark:text-zinc-950">
            FM
          </div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-zinc-50">
            {registering ? 'Cadastrar acesso ao FinMind' : 'FinMind Pessoal'}
          </h1>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {registering && (
            <FormField label="Convite de cadastro" htmlFor="registration-invitation">
              <Input id="registration-invitation" name="invitation" type="password" autoComplete="off" maxLength={128} required />
            </FormField>
          )}
          <FormField label="E-mail de Acesso" htmlFor="login-email">
            <Input id="login-email" name="email" type="email" defaultValue={defaultEmail} maxLength={254} autoComplete="username" required />
          </FormField>
          <FormField
            label="Senha de Acesso"
            htmlFor="login-password"
            hint={registering ? 'Use pelo menos 16 caracteres.' : undefined}
          >
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 16 : undefined}
              maxLength={72}
              required
            />
          </FormField>
          {registering && (
            <FormField label="Confirme a senha" htmlFor="registration-password-confirmation">
              <Input id="registration-password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" minLength={16} maxLength={72} required />
            </FormField>
          )}
          <div aria-hidden="true" className="hidden">
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full">
            <Lock className="h-4 w-4" />
            {registering ? 'Cadastrar e entrar' : 'Entrar no Painel Financeiro'}
          </Button>
        </form>

        {(registering || registrationOpen) && (
          <Link className="inline-block text-sm font-medium text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300" href={registering ? '/' : '/?cadastro=1'}>
            {registering ? 'Voltar para o login' : 'Cadastrar com convite'}
          </Link>
        )}
      </div>
    </main>
  );
}
