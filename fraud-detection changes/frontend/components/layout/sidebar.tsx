'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronLeft,
  FileSearch,
  LayoutDashboard,
  Radio,
  Scale,
  Search,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/types';
import { useUIStore } from '@/lib/stores/ui-store';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

const NAV: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}[] = [
  { label: 'Mission Control', href: '/mission-control', icon: LayoutDashboard, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Fraud Guard', href: '/fraud-guard', icon: Shield, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Infrastructure', href: '/infrastructure', icon: Radio, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Rules Engine', href: '/rules-engine', icon: Scale, roles: ['OPS_MANAGER', 'ADMIN'] },
  { label: 'Review Queue', href: '/fraud-guard/review', icon: Search, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN'] },
  { label: 'AI Copilot', href: '/copilot', icon: Bot, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Audit Trail', href: '/audit-trail', icon: FileSearch, roles: ['ANALYST', 'OPS_MANAGER', 'ADMIN', 'BANK_PARTNER'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'OPS_MANAGER'] },
  { label: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const items = NAV.filter((n) => !user || n.roles.includes(user.role as Role));

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="sidebar-glass relative z-30 hidden h-full shrink-0 lg:flex"
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex h-topbar items-center justify-between border-b border-bg-border px-4">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary">
                <Activity className="h-4 w-4 text-text-inverted" />
              </div>
              <div>
                <p className="text-small font-semibold">DecisionOS</p>
                <p className="text-micro text-text-muted">Risk Operations</p>
              </div>
            </div>
          )}
          <button type="button" onClick={toggleSidebar} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated">
            <ChevronLeft className={cn('h-4 w-4 transition', sidebarCollapsed && 'rotate-180')} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-0.5 p-3">
          {items.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} title={sidebarCollapsed ? label : undefined}>
                <span
                  className={cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-small font-medium transition',
                    active ? 'text-brand-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-brand-primary/10 ring-1 ring-brand-primary/25"
                    />
                  )}
                  <Icon className="relative h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="relative">{label}</span>}
                </span>
              </Link>
            );
          })}
        </nav>

        {user && !sidebarCollapsed && (
          <div className="border-t border-bg-border p-3">
            <p className="truncate text-small font-medium">{user.username}</p>
            <p className="font-mono text-micro uppercase text-text-muted">{user.role}</p>
            <button type="button" onClick={() => { api.auth.logout(); router.push('/sign-in'); }} className="mt-2 text-micro text-text-muted hover:text-semantic-block">
              Sign out
            </button>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
