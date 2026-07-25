export function Progress({ value, label, className }: Readonly<{ value: number; label: string; className?: string }>) {
  const normalized = Math.min(100, Math.max(0, value));
  return <div className={className}><div className="flex items-center justify-between gap-3 text-xs font-semibold text-stone-600"><span>{label}</span><span>{normalized}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={normalized}><div className="h-full rounded-full bg-teal-700 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${normalized}%` }} /></div></div>;
}
