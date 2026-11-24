import * as React from 'react';
import {
  ensurePersonalUserInitialized,
  getSession,
  isPublicAuthRequired,
  isSessionExplicitlyLoggedOut,
} from '@/features/auth';
import { findSessionUser } from '@/features/auth/services/user-bootstrap';
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

  if (loggedOut) {
    const defaultEmail = publicAuthRequired ? '' : (await ensurePersonalUserInitialized()).email;
    return <LoginView defaultEmail={defaultEmail} />;
  }

  const user = publicAuthRequired
    ? await findSessionUser(session)
    : await ensurePersonalUserInitialized();
  if (!user) return <LoginView defaultEmail="" />;

  const workbenchProps = await loadSerializedDashboardData({
    user,
    resolvedParams,
  });

  return (
    <React.Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <FinMindWorkbench {...workbenchProps} />
    </React.Suspense>
  );
}
