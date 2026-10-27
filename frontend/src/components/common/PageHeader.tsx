import React from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-sm font-medium text-blue-800">{eyebrow}</p>
        )}
        <h1 className="mt-0.5 text-2xl font-semibold text-neutral-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
