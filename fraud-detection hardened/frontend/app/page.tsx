// Root page — redirects to /dashboard (handled by middleware, this is a fallback)
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
