'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useUIStore } from '@/lib/stores/ui-store';

const ROUTES = [
  { label: 'Mission Control', href: '/mission-control' },
  { label: 'Fraud Guard', href: '/fraud-guard' },
  { label: 'Infrastructure', href: '/infrastructure' },
  { label: 'Rules Engine', href: '/rules-engine' },
  { label: 'AI Copilot', href: '/copilot' },
  { label: 'Audit Trail', href: '/audit-trail' },
  { label: 'Settings', href: '/settings' },
];

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, setAssistantOpen } = useUIStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandOpen, setCommandOpen]);

  if (!commandOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setCommandOpen(false)}>
      <div className="mx-auto mt-[15vh] max-w-lg px-4" onClick={(e) => e.stopPropagation()}>
        <Command className="overflow-hidden rounded-xl border border-bg-border bg-bg-elevated shadow-elevated">
          <Command.Input
            placeholder="Navigate workspace…"
            className="w-full border-b border-bg-border bg-transparent px-4 py-3 text-body outline-none"
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-small text-text-muted">No results.</Command.Empty>
            <Command.Group heading="Navigation">
              {ROUTES.map((r) => (
                <Command.Item
                  key={r.href}
                  value={r.label}
                  onSelect={() => {
                    setCommandOpen(false);
                    router.push(r.href);
                  }}
                  className="cursor-pointer rounded-lg px-3 py-2 text-small aria-selected:bg-brand-primary/10 aria-selected:text-brand-primary"
                >
                  {r.label}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() => {
                  setCommandOpen(false);
                  setAssistantOpen(true);
                }}
                className="cursor-pointer rounded-lg px-3 py-2 text-small aria-selected:bg-brand-primary/10"
              >
                Open AI Copilot
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
