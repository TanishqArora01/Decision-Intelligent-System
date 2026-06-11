'use client';

import { Bell, Bot, Search, Signal } from 'lucide-react';
import { useWorkspace } from '@/providers/workspace-provider';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { bankName, env, setEnv } = useWorkspace();
  const streamingLive = useWorkspaceStore((s) => s.streamingLive);
  const { setAssistantOpen } = useUIStore();

  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center gap-3 border-b border-bg-border bg-bg-surface/80 px-6 backdrop-blur-xl">
      <div className="hidden md:block">
        <p className="text-small font-medium">{bankName}</p>
        <p className="text-micro text-text-muted capitalize">{env} workspace</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden rounded-lg border border-bg-border p-0.5 sm:flex">
          {(['production', 'staging', 'sandbox'] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEnv(e)}
              className={cn(
                'rounded-md px-2.5 py-1 font-mono text-micro capitalize transition',
                env === e ? 'bg-brand-primary/15 text-brand-primary' : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {e}
            </button>
          ))}
        </div>

        <div
          className={cn(
            'hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-micro sm:flex',
            streamingLive ? 'border-semantic-approve/30 text-semantic-approve' : 'border-bg-border text-text-muted',
          )}
        >
          <Signal className={cn('h-3 w-3', streamingLive && 'animate-pulse')} />
          {streamingLive ? 'Live' : 'Paused'}
        </div>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-semantic-block" />
        </Button>

        <Button variant="secondary" size="sm" onClick={() => setAssistantOpen(true)} className="hidden sm:inline-flex">
          <Bot className="h-4 w-4" />
          Copilot
        </Button>

        <kbd className="hidden rounded border border-bg-border px-2 py-1 font-mono text-micro text-text-muted lg:inline">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}
