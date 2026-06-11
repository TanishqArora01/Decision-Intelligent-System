import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-bg-border bg-bg-surface">
      <div className="mx-auto grid max-w-content gap-8 px-6 py-16 md:grid-cols-4">
        <div>
          <p className="font-semibold">DecisionOS</p>
          <p className="mt-2 text-small text-text-muted">The AI-native operating layer for financial risk.</p>
          <div className="mt-4 flex items-center gap-2 text-micro">
            <span className="h-2 w-2 animate-pulse rounded-full bg-semantic-approve" />
            <span className="text-semantic-approve">All systems operational</span>
          </div>
        </div>
        {[
          { title: 'Product', links: ['Mission Control', 'Fraud Guard', 'Rules Engine', 'Copilot'] },
          { title: 'Company', links: ['About', 'Careers', 'Contact', 'Status'] },
          { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Compliance'] },
        ].map((col) => (
          <div key={col.title}>
            <p className="metric-label">{col.title}</p>
            <ul className="mt-3 space-y-2 text-small text-text-secondary">
              {col.links.map((l) => (
                <li key={l}>
                  <Link href="/sign-in" className="hover:text-text-primary">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-bg-border py-6 text-center text-micro text-text-muted">
        © {new Date().getFullYear()} DecisionOS. Built for regulated financial infrastructure.
      </div>
    </footer>
  );
}
