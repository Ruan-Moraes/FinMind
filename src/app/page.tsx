import * as React from 'react';
import {
  ensurePersonalUserInitialized,
  getSession,
  isPublicAuthRequired,
  isSessionExplicitlyLoggedOut,
} from '@/features/auth';
import { isOwnerRegistrationOpen } from '@/features/auth/services/owner-registration';
import { findSessionUser } from '@/features/auth/services/user-bootstrap';
import { loadSerializedDashboardData } from '@/features/analytics/services/dashboard-data-loader';
import { FinMindWorkbench } from '@/features/dashboard/components/finmind-workbench';
import { LoginView } from '@/features/auth/components/login-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    cadastro?: string;
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
  const user = publicAuthRequired
    ? await findSessionUser(await getSession())
    : await ensurePersonalUserInitialized();

  if (publicAuthRequired && !user) {
    const registrationOpen = await isOwnerRegistrationOpen();
    return (
      <LoginView
        key={registrationOpen && resolvedParams.cadastro === '1' ? 'registration' : 'login'}
        defaultEmail=""
        registrationOpen={registrationOpen}
        registering={registrationOpen && resolvedParams.cadastro === '1'}
      />
    );
  }
  if (!user || await isSessionExplicitlyLoggedOut()) {
    return <LoginView defaultEmail={user?.email ?? ''} />;
  }

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
