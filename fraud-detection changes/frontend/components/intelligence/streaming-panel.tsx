'use client';

import { motion } from 'framer-motion';
import { Activity, Cpu, Radio, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface StreamEvent {
  id: string;
  type: string;
  message: string;
  time: string;
  severity?: 'info' | 'warn' | 'critical';
}

interface StreamingPanelProps {
  events: StreamEvent[];
  throughput?: number;
  latencyMs?: number;
  className?: string;
}

export function StreamingPanel({ events, throughput = 0, latencyMs = 0, className }: StreamingPanelProps) {
  return (
    <div className={cn('glass-panel flex h-full flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent-cyan" />
          <h3 className="text-sm font-semibold text-text-primary">Live Event Stream</h3>
          <Badge variant="cyan">LIVE</Badge>
        </div>
        <div className="flex gap-4 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-accent-green" />
            {throughput}/s
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            {latencyMs}ms
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px overflow-hidden">
          <div className="h-full w-1/3 animate-stream bg-gradient-to-r from-transparent via-accent-cyan to-transparent" />
        </div>
        <div className="scrollbar-thin h-full space-y-2 overflow-y-auto p-4">
          {events.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">Awaiting stream events…</p>
          ) : (
            events.map((ev, i) => (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="rounded-xl border border-border-primary bg-surface-glass px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-accent-cyan">{ev.type}</span>
                  <span className="text-[10px] text-text-muted">{ev.time}</span>
                </div>
                <p className="mt-1 text-xs text-text-secondary">{ev.message}</p>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="border-t border-border-primary px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Activity className="h-3.5 w-3.5 text-accent-green animate-pulse" />
          Pipeline healthy · Redpanda · Feature Engine · Stage 1–3
        </div>
      </div>
    </div>
  );
}
