import * as React from 'react';
import {
  ensurePersonalUserInitialized,
  getSession,
  isPublicAuthRequired,
  isSessionExplicitlyLoggedOut,
} from '@/features/auth';
import { getActiveSsoSession } from '@/features/auth/sso';
import { loadSerializedDashboardData } from '@/features/analytics/services/dashboard-data-loader';
import { FinMindWorkbench } from '@/features/dashboard/components/finmind-workbench';
import { LoginView } from '@/features/auth/components/login-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    month?: string;
    year?: string;
    compMonthA?: string;
    compYearA?: string;
    compMonthB?: string;
    compYearB?: string;
  }>;
}

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const publicAuthRequired = isPublicAuthRequired();
  const [session, loggedOut] = await Promise.all([
    getSession(),
    isSessionExplicitlyLoggedOut(),
  ]);

  if (loggedOut || (publicAuthRequired && !session?.userId)) {
    const defaultEmail = publicAuthRequired
      ? ''
      : (await ensurePersonalUserInitialized()).email;
    return <LoginView defaultEmail={defaultEmail} />;
  }

  const [user, ssoState] = await Promise.all([
    ensurePersonalUserInitialized(),
    getActiveSsoSession(),
  ]);

  const workbenchProps = await loadSerializedDashboardData({
    user,
    ssoState,
    resolvedParams,
  });

  return (
    <React.Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <FinMindWorkbench {...workbenchProps} />
    </React.Suspense>
  );
}
