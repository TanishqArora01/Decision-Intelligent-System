import { getApiBase } from '@/lib/api-health';

export interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

/** Stream tokens from POST /copilot/chat (SSE). */
export async function streamCopilotChat(
  messages: CopilotMessage[],
  onToken: (token: string) => void,
  onDone: (fullContent: string) => void,
  onError: (err: Error) => void,
): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/copilot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages }),
    });
  } catch (e) {
    onError(e instanceof Error ? e : new Error('Network error'));
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    onError(new Error(typeof err.detail === 'string' ? err.detail : `HTTP ${res.status}`));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError(new Error('Streaming not supported'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6)) as { token?: string; done?: boolean; content?: string };
        if (data.token) {
          full += data.token;
          onToken(data.token);
        }
        if (data.done) {
          onDone(data.content ?? full);
          return;
        }
      } catch {
        /* skip malformed chunks */
      }
    }
  }
  onDone(full);
}

/** Fallback when SSE fails. */
export async function copilotChatSync(messages: CopilotMessage[]): Promise<string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${getApiBase()}/copilot/chat/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Copilot error: ${res.status}`);
  const data = (await res.json()) as { content: string };
  return data.content;
}
