import type { ElementType } from 'react';

export function SectionLabel({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-surface-border">
      <Icon className="w-4 h-4 text-accent-500" />
      <span className="text-sm font-medium text-white">{label}</span>
    </div>
  );
}
