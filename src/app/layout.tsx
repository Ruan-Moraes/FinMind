import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import {
  ensurePersonalUserInitialized,
  getSession,
  isPublicAuthRequired,
} from '@/features/auth';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FinMind | Gestão Financeira Pessoal & Metas de Carteira',
  description:
    'Controle financeiro pessoal completo com metas de carteira, custos fixos, comparativo mensal e assistente financeiro inteligente.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lê o tema salvo no banco no servidor para evitar flicker (DESIGN_SYSTEM.md Seção 6)
  let savedTheme = 'DARK';
  const session = await getSession();
  if (!isPublicAuthRequired() || session?.userId) {
    const user = await ensurePersonalUserInitialized();
    savedTheme = user.settings?.theme || 'DARK';
  }
  const isDark = savedTheme === 'DARK' || savedTheme === 'SYSTEM';

  return (
    <html lang="pt-BR" className={`${inter.variable} ${isDark ? 'dark' : ''}`} suppressHydrationWarning>
      <body className="font-sans antialiased bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
