// Root page — redirects to /login (middleware will handle auth check for protected routes)
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/login');
}
