'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { useEffect } from 'react';

const SLIDES = [
  { bank: 'Axis Bank', quote: 'DecisionOS cut our manual review queue by 38% in the first quarter.', name: 'Priya Sharma', title: 'Head of Fraud Operations' },
  { bank: 'HDFC', quote: 'Sub-12ms p95 latency at our peak volume—finally an AI layer we can trust in production.', name: 'Arjun Mehta', title: 'CTO, Digital Banking' },
  { bank: 'RBL', quote: 'Explainable copilot narratives accelerated our SAR preparation materially.', name: 'Elena Vasquez', title: 'BSA Officer' },
];

export function TestimonialCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });

  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <section className="mx-auto max-w-content overflow-hidden px-6 py-24">
      <p className="metric-label text-center text-brand-primary">Trusted by risk teams</p>
      <div ref={emblaRef} className="mt-8 overflow-hidden">
        <div className="flex gap-6">
          {SLIDES.map((s) => (
            <div key={s.bank} className="min-w-0 flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33%]">
              <div className="surface-card h-full p-6">
                <p className="font-mono text-micro text-brand-primary">{s.bank}</p>
                <p className="mt-4 text-body text-text-secondary">&ldquo;{s.quote}&rdquo;</p>
                <p className="mt-4 text-small font-medium">{s.name}</p>
                <p className="text-micro text-text-muted">{s.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
