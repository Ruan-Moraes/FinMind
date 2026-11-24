'use client';

import * as React from 'react';
import { useWorkbench } from '@/features/dashboard/context/workbench-context';
import {
  StaticRuleSkipFeedbackBanner,
  useStaticRuleSkipToggle,
} from '@/features/planning/components/static-rule-skip-feedback';
import { StaticRulesMobileList } from '@/features/planning/components/static-rules-mobile-list';
import { StaticRulesDesktopTable } from '@/features/planning/components/static-rules-desktop-table';
import { StaticPaidTxTable } from '@/features/planning/components/static-paid-tx-table';

export function StaticRulesSection() {
  const { props, wb } = useWorkbench();
  const { selectedMonth, selectedYear } = props;
  const { router } = wb;

  const handleRefresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const { togglingId, feedback, handleToggleSkip, handleUndo, dismissFeedback } =
    useStaticRuleSkipToggle(selectedMonth, selectedYear, handleRefresh);

  return (
    <div className="space-y-3">
      <StaticRuleSkipFeedbackBanner
        feedback={feedback}
        isUndoing={Boolean(feedback?.ruleId && togglingId === feedback.ruleId)}
        onUndo={handleUndo}
        onDismiss={dismissFeedback}
      />
      <StaticRulesMobileList togglingId={togglingId} onToggleSkip={handleToggleSkip} />
      <StaticRulesDesktopTable togglingId={togglingId} onToggleSkip={handleToggleSkip} />
      <StaticPaidTxTable />
    </div>
  );
}
