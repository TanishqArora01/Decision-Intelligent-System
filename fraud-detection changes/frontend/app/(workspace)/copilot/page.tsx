import { PageWrapper } from '@/components/layout/page-wrapper';
import { CopilotChat } from '@/components/copilot/copilot-chat';

export default function CopilotPage() {
  return (
    <PageWrapper>
      <header className="mb-4">
        <p className="metric-label text-brand-primary">Workspace</p>
        <h1 className="text-display">XAI Copilot</h1>
      </header>
      <div className="surface-card flex min-h-[70vh] flex-col overflow-hidden">
        <CopilotChat compact />
      </div>
    </PageWrapper>
  );
}
