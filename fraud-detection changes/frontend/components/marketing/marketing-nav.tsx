'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled ? 'border-b border-bg-border bg-bg-base/80 backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary">
            <Activity className="h-4 w-4 text-text-inverted" />
          </div>
          <span className="font-semibold tracking-tight">DecisionOS</span>
        </Link>
        <nav className="hidden items-center gap-8 text-small text-text-secondary md:flex">
          <Link href="#features" className="hover:text-text-primary">
            Platform
          </Link>
          <Link href="#architecture" className="hover:text-text-primary">
            Architecture
          </Link>
          <Link href="/pricing" className="hover:text-text-primary">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 text-small text-text-secondary hover:text-text-primary">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand-primary px-4 py-2 text-small font-medium text-text-inverted transition hover:opacity-90"
          >
            Request demo
          </Link>
        </div>
      </div>
    </header>
  );
}
