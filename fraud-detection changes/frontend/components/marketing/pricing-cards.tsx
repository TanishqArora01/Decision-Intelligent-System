'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import Link from 'next/link';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';

const PLANS = [
  {
    name: 'Growth',
    monthly: 2499,
    features: ['50K decisions/day', '2 analyst seats', 'Stage 1-2 rules', 'Email support', '7-day audit retention', 'Standard SLA'],
  },
  {
    name: 'Scale',
    monthly: 7999,
    popular: true,
    features: [
      '500K decisions/day',
      '10 analyst seats',
      'Full pipeline + shadow rules',
      'XAI copilot',
      'Priority support',
      '1-year audit retention',
      '99.9% SLA',
    ],
  },
  {
    name: 'Enterprise',
    monthly: 0,
    features: [
      'Unlimited volume',
      'Dedicated VPC',
      'Custom models',
      'FRAML convergence',
      '24/7 white-glove',
      '7-year retention',
      'Custom SLA',
    ],
  },
];

export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="mx-auto max-w-content px-6 py-24">
      <div className="text-center">
        <p className="metric-label text-brand-primary">Pricing</p>
        <h2 className="mt-2 text-display">Transparent plans for every bank</h2>
        <div className="mt-6 inline-flex rounded-lg border border-bg-border p-1">
          {(['Monthly', 'Annual'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAnnual(m === 'Annual')}
              className={`rounded-md px-4 py-1.5 text-small transition ${
                annual === (m === 'Annual') ? 'bg-brand-primary text-text-inverted' : 'text-text-muted'
              }`}
            >
              {m}
              {m === 'Annual' && <span className="ml-1 text-micro opacity-80">-10%</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = p.monthly === 0 ? null : Math.round(p.monthly * (annual ? 0.9 : 1));
          return (
            <motion.div
              key={p.name}
              whileHover={{ y: -2 }}
              className={`surface-card relative p-6 ${p.popular ? 'border-brand-primary ring-1 ring-brand-primary' : ''}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-primary px-3 py-0.5 text-micro text-text-inverted">
                  Most popular
                </span>
              )}
              <h3 className="text-subheading">{p.name}</h3>
              <p className="mt-4 font-mono text-display">
                {price === null ? (
                  'Custom'
                ) : (
                  <>
                    $<CountUp end={price} duration={0.8} separator="," />
                    <span className="text-small text-text-muted">/mo</span>
                  </>
                )}
              </p>
              <ul className="mt-6 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-small text-text-secondary">
                    <Check className="h-4 w-4 shrink-0 text-semantic-approve" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`mt-8 block rounded-lg py-2.5 text-center text-small font-medium transition ${
                  p.popular
                    ? 'bg-brand-primary text-text-inverted hover:opacity-90'
                    : 'border border-bg-border hover:border-bg-border-strong'
                }`}
              >
                {p.monthly === 0 ? 'Contact sales' : 'Start free'}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
