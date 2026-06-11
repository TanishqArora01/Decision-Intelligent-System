const DEFAULT_BASE = '/api/backend';

export function getApiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_BASE;
}

/** Probe backend with retries (production-friendly startup). */
export async function checkApiHealth(maxAttempts = 5): Promise<boolean> {
  const base = getApiBase();
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${base}/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  return false;
}

export function friendlyApiError(err: unknown): string {
  if (err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message))) {
    return 'We could not reach the platform services. Please wait a moment and try again.';
  }
  if (err instanceof Error) {
    if (/invalid credentials/i.test(err.message)) {
      return 'Invalid username or password.';
    }
    if (/cannot reach|backend|ECONNREFUSED|500/i.test(err.message)) {
      return 'Platform services are starting up. Please try again in a few seconds.';
    }
    return err.message;
  }
  return 'Sign-in failed. Please try again.';
}
