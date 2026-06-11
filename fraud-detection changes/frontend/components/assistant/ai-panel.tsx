'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui-store';
import { CopilotChat } from '@/components/copilot/copilot-chat';

export function AIAssistantPanel() {
  const { assistantOpen, setAssistantOpen } = useUIStore();

  return (
    <AnimatePresence>
      {assistantOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setAssistantOpen(false)}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-bg-secondary shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-emerald-400" />
                <div>
                  <p className="font-semibold">AI Copilot</p>
                  <p className="text-[10px] text-text-muted">Investigation Assistant · W08</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                className="rounded-lg p-2 hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CopilotChat compact />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
