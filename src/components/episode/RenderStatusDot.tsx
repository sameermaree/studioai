export function RenderStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-studio-600',
    queued: 'bg-amber-500',
    rendering: 'bg-amber-500 animate-pulse',
    completed: 'bg-accent-500',
    failed: 'bg-danger-500',
  };

  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${colors[status] ?? 'bg-studio-600'}`}
      title={status}
    />
  );
}
