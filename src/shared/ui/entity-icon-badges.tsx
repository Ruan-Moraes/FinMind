import * as React from 'react';
import { getAccountTypeIcon, getCategoryLucideIcon } from '@/shared/icons/icon-inference';

export function CategoryIconBadge({
  icon,
  name,
  color = '#6366f1',
  size = 'md',
  showDot = false,
}: {
  icon?: string | null;
  name?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}) {
  const IconComponent = getCategoryLucideIcon(icon, name);
  const resolvedColor = color || '#6366f1';

  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-11 w-11 rounded-xl',
  }[size];

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4.5 w-4.5',
    lg: 'h-5 w-5',
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 border transition-transform ${sizeClasses}`}
      style={{
        backgroundColor: `${resolvedColor}18`,
        borderColor: `${resolvedColor}38`,
        color: resolvedColor,
      }}
    >
      <IconComponent className={iconSizes} />
      {showDot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950"
          style={{ backgroundColor: resolvedColor }}
        />
      )}
    </div>
  );
}

export function AccountIconBadge({
  type,
  color = '#10b981',
  size = 'md',
}: {
  type?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const IconComponent = getAccountTypeIcon(type);
  const resolvedColor = color || '#10b981';

  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-11 w-11 rounded-xl',
  }[size];

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-4.5 w-4.5',
    lg: 'h-5 w-5',
  }[size];

  return (
    <div
      className={`relative flex items-center justify-center shrink-0 border ${sizeClasses}`}
      style={{
        backgroundColor: `${resolvedColor}18`,
        borderColor: `${resolvedColor}38`,
        color: resolvedColor,
      }}
    >
      <IconComponent className={iconSizes} />
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-950"
        style={{ backgroundColor: resolvedColor }}
      />
    </div>
  );
}
