import { useSimulationStore } from '@/lib/stores/simulation-store';

/** Offline fallback when backend copilot is unreachable. */
export function buildLocalCopilotAnswer(question: string): string {
  const q = question.toLowerCase();
  const { metrics, recentDecisions } = useSimulationStore.getState();
  const top = recentDecisions[0];

  if (/shap|feature|contribution/i.test(q)) {
    if (top?.shap?.length) {
      const lines = top.shap
        .map((s) => `| ${s.feature} | ${s.contribution.toFixed(3)} |`)
        .join('\n');
      return `**Local SHAP trace** (latest simulated decision)\n\n| Feature | Weight |\n|---|---:|\n${lines}`;
    }
  }

  if (/trend|summary|hour/i.test(q)) {
    return (
      `**Local pipeline summary**\n\n` +
      `- Transactions analyzed: **${metrics.transactionsAnalyzed.toLocaleString()}**\n` +
      `- P95 latency: **${metrics.p95LatencyMs.toFixed(1)} ms**\n` +
      `- Model confidence: **${metrics.modelConfidence.toFixed(3)}**`
    );
  }

  if (top) {
    return (
      `**Local investigation note**\n\n` +
      `Latest decision \`${top.txnId}\`: **${top.outcome}**, P(fraud) **${(top.pFraud * 100).toFixed(1)}%**, ` +
      `AML **${top.amlCategory}**. Pipeline: ${top.pipelinePath}.\n\n` +
      `_Backend copilot was unreachable; showing client simulation context._`
    );
  }

  return (
    'I could not reach the copilot service. Ensure **app-backend** is running on port 8400, then try again. ' +
    'You can also enable **Live Dashboard Ingestion** in Settings to populate local decision context.'
  );
}
