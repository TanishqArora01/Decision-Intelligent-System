'use client';

import Link from 'next/link';
import { Play } from 'lucide-react';
import { HeroCanvas } from '@/components/marketing/hero-canvas';
import { LiveDemoTicker } from '@/components/marketing/live-demo-ticker';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { PricingCards } from '@/components/marketing/pricing-cards';
import { StatsSection } from '@/components/marketing/stats-section';
import { ArchitectureSection } from '@/components/marketing/architecture-section';
import { TestimonialCarousel } from '@/components/marketing/testimonial-carousel';
import { BankLogos } from '@/components/marketing/bank-logos';

export default function LandingPage() {
  return (
    <>
      <section className="relative min-h-[90vh] overflow-hidden">
        <HeroCanvas />
        <div className="relative z-10 mx-auto flex max-w-content flex-col items-center px-6 pt-28 text-center">
          <p className="metric-label text-brand-primary">DecisionOS</p>
          <h1 className="mt-4 max-w-4xl text-hero text-gradient-hero">
            The AI brain behind every banking decision.
          </h1>
          <p className="mt-6 max-w-xl text-subheading text-text-secondary">
            Autonomous risk and decision operations for banks, fintechs, and enterprise partners—sub-millisecond,
            explainable, and audit-ready.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-brand-primary px-6 py-3 text-body font-medium text-text-inverted shadow-glow transition hover:opacity-90"
            >
              Start free
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-lg border border-bg-border-strong px-6 py-3 text-body text-text-primary transition hover:bg-bg-surface"
            >
              <Play className="h-4 w-4" />
              Watch demo
            </Link>
          </div>
          <BankLogos />
        </div>
      </section>

      <LiveDemoTicker />
      <FeatureGrid />
      <ArchitectureSection />
      <PricingCards />
      <StatsSection />
      <TestimonialCarousel />
    </>
  );
}
