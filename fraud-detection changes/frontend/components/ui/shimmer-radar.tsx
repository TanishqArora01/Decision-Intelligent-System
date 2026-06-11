'use client';

export function ShimmerRadar({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative h-24 w-24">
        <span className="absolute inset-0 animate-ping rounded-full border border-emerald-500/30" />
        <span className="absolute inset-2 animate-pulse rounded-full border border-emerald-500/50" />
        <span className="absolute inset-4 rounded-full bg-emerald-500/10" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
        </span>
      </div>
      <p className="mt-6 max-w-sm text-center text-sm text-text-secondary">{label}</p>
    </div>
  );
}
