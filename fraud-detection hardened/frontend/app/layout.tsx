'use client';
import './globals.css';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity, BarChart2, FileSearch, Home,
  LogOut, Menu, Users, X, AlertTriangle,
} from 'lucide-react';
import { clearTokens } from '../lib/api';
import { AuthProvider, useAuth } from '../lib/auth-context';
import type { Role } from '../lib/types';

const NAV: { label: string; href: string; icon: React.FC<any>; roles: Role[] }[] = [
  { label: 'Dashboard',    href: '/dashboard',    icon: Home,          roles: ['ANALYST','OPS_MANAGER','ADMIN','BANK_PARTNER'] },
  { label: 'Review Queue', href: '/review-queue', icon: AlertTriangle, roles: ['ANALYST','OPS_MANAGER','ADMIN'] },
  { label: 'Analytics',   href: '/analytics',    icon: BarChart2,     roles: ['OPS_MANAGER','ADMIN','BANK_PARTNER'] },
  { label: 'Audit Trail', href: '/audit',        icon: FileSearch,    roles: ['ANALYST','OPS_MANAGER','ADMIN','BANK_PARTNER'] },
  { label: 'Users',       href: '/users',        icon: Users,         roles: ['ADMIN'] },
];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:        'bg-red-100 text-red-700',
  OPS_MANAGER:  'bg-purple-100 text-purple-700',
  ANALYST:      'bg-blue-100 text-blue-700',
  BANK_PARTNER: 'bg-green-100 text-green-700',
};

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, setUser } = useAuth();

  const logout = () => {
    clearTokens();
    setUser(null);
    router.push('/login');
  };

  const filteredNav = NAV.filter(n => !user || n.roles.includes(user.role as Role));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed top-0 left-0 z-30 h-full w-64 bg-gray-900 text-white
        flex flex-col transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Ritam Guard</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNav.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href} onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}>
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="border-t border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold uppercase">
                {user.username[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_COLORS[user.role as Role] ?? 'bg-gray-700 text-gray-300'}`}>
                  {user.role}
                </span>
              </div>
            </div>
            <button onClick={logout}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors mt-1">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sideOpen, setSideOpen] = useState(false);
  const pathname = usePathname();
  const isPublic = pathname === '/login' || pathname === '/';

  if (isPublic) {
    return (
      <html lang="en">
        <head>
          <title>Ritam Guard — Decision Intelligence Platform</title>
          <meta name="description" content="Enterprise fraud detection and decision intelligence platform" />
        </head>
        <body className="bg-gray-50 text-gray-900 antialiased">
          <AuthProvider>
            {children}
          </AuthProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <title>Ritam Guard — Decision Intelligence Platform</title>
        <meta name="description" content="Enterprise fraud detection and decision intelligence platform" />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar open={sideOpen} onClose={() => setSideOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:hidden">
                <button onClick={() => setSideOpen(true)} className="text-gray-500 hover:text-gray-900">
                  <Menu className="w-5 h-5" />
                </button>
                <span className="font-semibold text-sm">Ritam Guard</span>
              </header>
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
