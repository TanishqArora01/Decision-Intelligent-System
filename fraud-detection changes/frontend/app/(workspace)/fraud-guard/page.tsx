import { PageWrapper } from '@/components/layout/page-wrapper';
import { TransactionGrid } from '@/components/dashboard/transaction-grid';

export default function FraudGuardPage() {
  return (
    <PageWrapper>
      <TransactionGrid title="Fraud Guard" />
    </PageWrapper>
  );
}
