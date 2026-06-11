import { create } from 'zustand';
import type { CopilotMessage } from '@/lib/copilot-client';

interface CopilotState {
  messages: CopilotMessage[];
  addMessage: (msg: CopilotMessage) => void;
  appendToLastAssistant: (token: string) => void;
  finalizeLastAssistant: (content: string) => void;
  setMessages: (messages: CopilotMessage[]) => void;
  reset: () => void;
}

const WELCOME: CopilotMessage = {
  role: 'assistant',
  content:
    'Fraud IQ Copilot online. I analyze live decision telemetry, SHAP-style features, graph linkages, and SAR narratives. Ask a question or use a shortcut below.',
};

export const useCopilotStore = create<CopilotState>((set) => ({
  messages: [WELCOME],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLastAssistant: (token) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = { role: 'assistant', content: last.content + token };
      } else {
        messages.push({ role: 'assistant', content: token });
      }
      return { messages };
    }),
  finalizeLastAssistant: (content) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = { role: 'assistant', content };
      }
      return { messages };
    }),
  setMessages: (messages) => set({ messages }),
  reset: () => set({ messages: [WELCOME] }),
}));
