'use client';

import { Bot } from 'lucide-react';
import { CopilotChat } from '@/components/copilot/copilot-chat';

export default function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col p-4 lg:p-8">
      <header className="mb-4 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Workspace 08</p>
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <Bot className="h-8 w-8 text-emerald-400" />
          AI Copilot
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Investigation assistant with live pipeline context — responses stream from app-backend.
        </p>
      </header>
      <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <CopilotChat compact />
      </div>
    </div>
  );
}
