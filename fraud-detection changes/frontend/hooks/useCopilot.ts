'use client';

import { useCallback, useState } from 'react';
import { copilotChatSync, streamCopilotChat, type CopilotMessage } from '@/lib/copilot-client';
import { useCopilotStore } from '@/lib/stores/copilot-store';
import { buildLocalCopilotAnswer } from '@/lib/copilot-local';

export function useCopilot() {
  const { messages, addMessage, appendToLastAssistant, finalizeLastAssistant } = useCopilotStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;

      setError(null);
      setLoading(true);

      const history: CopilotMessage[] = [...messages.filter((m) => m.content), { role: 'user', content: q }];
      addMessage({ role: 'user', content: q });
      addMessage({ role: 'assistant', content: '' });

      try {
        await streamCopilotChat(
          history,
          (token) => appendToLastAssistant(token),
          (full) => finalizeLastAssistant(full),
          async () => {
            try {
              const content = await copilotChatSync(history);
              finalizeLastAssistant(content);
            } catch {
              const local = buildLocalCopilotAnswer(q);
              finalizeLastAssistant(local);
            }
          },
        );
      } catch {
        try {
          const content = await copilotChatSync(history);
          finalizeLastAssistant(content);
        } catch {
          finalizeLastAssistant(buildLocalCopilotAnswer(q));
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, addMessage, appendToLastAssistant, finalizeLastAssistant],
  );

  return { messages, send, loading, error, setError };
}
