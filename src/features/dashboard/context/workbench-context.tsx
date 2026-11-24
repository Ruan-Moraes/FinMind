'use client';

import * as React from 'react';
import type { WorkbenchProps } from '@/features/dashboard/types/workbench-types';
import type { WorkbenchController } from '@/features/dashboard/hooks/use-workbench-controller';

interface WorkbenchContextValue {
  props: WorkbenchProps;
  wb: WorkbenchController;
}

const WorkbenchContext = React.createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({
  props,
  wb,
  children,
}: {
  props: WorkbenchProps;
  wb: WorkbenchController;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ props, wb }), [props, wb]);
  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const ctx = React.useContext(WorkbenchContext);
  if (!ctx) {
    throw new Error('useWorkbench deve ser usado dentro de <WorkbenchProvider>.');
  }
  return ctx;
}
