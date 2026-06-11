'use client';

import { useEffect, useRef, useState } from 'react';
import CountUp from 'react-countup';

const STATS = [
  { label: 'Decision latency', value: 12, suffix: 'ms', prefix: '<' },
  { label: 'Platform uptime', value: 99.95, suffix: '%', decimals: 2 },
  { label: 'Decisions per day', value: 850, suffix: 'K+', prefix: '' },
  { label: 'Explainable decisions', value: 100, suffix: '%' },
];

export function StatsSection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="stats-section border-y border-bg-border bg-bg-surface py-16">
      <div className="mx-auto grid max-w-content gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <p className="stat-number font-mono text-display text-brand-primary">
              {visible ? (
                <>
                  {s.prefix}
                  <CountUp end={s.value} decimals={s.decimals ?? 0} duration={1.5} />
                  {s.suffix}
                </>
              ) : (
                '—'
              )}
            </p>
            <p className="mt-2 text-small text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
