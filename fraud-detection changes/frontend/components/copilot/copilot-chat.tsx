'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Send, Sparkles } from 'lucide-react';
import { TypingIndicator } from '@/components/copilot/typing-indicator';
import { useCopilot } from '@/hooks/useCopilot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUGGESTIONS = [
  'Summarize fraud trends in the last hour',
  'Break down SHAP feature contribution values',
  'Trace cross-tenant identity linkages via graph cluster',
  'Generate formal FinCEN SAR narrative text for this case',
];

function renderMarkdownLite(text: string) {
  return text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const code = bold.replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 text-emerald-300">$1</code>');
    return (
      <p
        key={i}
        className="mb-1 last:mb-0"
        dangerouslySetInnerHTML={{ __html: code || '&nbsp;' }}
      />
    );
  });
}

export function CopilotChat({ compact = false }: { compact?: boolean }) {
  const { messages, send, loading, error } = useCopilot();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const submit = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    void send(q);
    setInput('');
  };

  return (
    <div className={`flex flex-col ${compact ? 'h-full min-h-0' : 'min-h-[70vh]'}`}>
      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-8 border border-slate-800 bg-bg-tertiary'
                : 'mr-4 border border-emerald-500/20 bg-emerald-500/5'
            }`}
          >
            {m.role === 'assistant' && !m.content && loading ? (
              <TypingIndicator />
            ) : (
              <div className="text-text-primary">{renderMarkdownLite(m.content)}</div>
            )}
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 text-xs text-red-400">{error}</p>}

      <div className="shrink-0 border-t border-slate-800 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={loading}
              onClick={() => submit(s)}
              className="rounded-full border border-slate-800 px-3 py-1 text-[10px] text-text-secondary transition hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-50"
            >
              <Sparkles className="mr-1 inline h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask the copilot…"
            disabled={loading}
          />
          <Button type="button" size="icon" disabled={loading} onClick={() => submit()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
