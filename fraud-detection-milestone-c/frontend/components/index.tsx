'use client';
import React from 'react';
import type { Action } from '../lib/types';

// ---------------------------------------------------------------------------
// DecisionBadge
// ---------------------------------------------------------------------------
const ACTION_STYLES: Record<string, string> = {
  APPROVE:       'bg-green-100  text-green-800  border-green-200',
  BLOCK:         'bg-red-100    text-red-800    border-red-200',
  STEP_UP_AUTH:  'bg-amber-100  text-amber-800  border-amber-200',
  MANUAL_REVIEW: 'bg-purple-100 text-purple-800 border-purple-200',
};
const ACTION_LABELS: Record<string, string> = {
  APPROVE: 'Approve', BLOCK: 'Block',
  STEP_UP_AUTH: 'Step-Up', MANUAL_REVIEW: 'Review',
};

export function DecisionBadge({ action, size = 'sm' }: { action: string; size?: 'xs' | 'sm' | 'md' }) {
  const style  = ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  const label  = ACTION_LABELS[action] ?? action;
  const padding = size === 'xs' ? 'px-1 py-0.5 text-[10px]' :
                  size === 'md' ? 'px-2 py-1 text-xs' :
                  'px-1.5 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center font-bold tracking-wider uppercase rounded-sm border ${style} ${padding}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FraudScoreBar
// ---------------------------------------------------------------------------
export function FraudScoreBar({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const pct   = Math.round(score * 100);
  const color = score >= 0.7 ? 'bg-red-500' :
                score >= 0.4 ? 'bg-amber-500' :
                               'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 h-1.5 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className={`text-xs font-mono font-semibold w-10 text-right
          ${score >= 0.7 ? 'text-red-600' : score >= 0.4 ? 'text-amber-600' : 'text-green-600'}`}>
          {pct}%
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------
export function KpiCard({
  title, value, sub, icon: Icon, color = 'blue',
}: {
  title: string; value: string | number; sub?: string;
  icon?: React.FC<any>; color?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'border-l-4 border-l-blue-600',
    green:  'border-l-4 border-l-green-600',
    red:    'border-l-4 border-l-red-600',
    amber:  'border-l-4 border-l-amber-600',
    purple: 'border-l-4 border-l-purple-600',
  };
  return (
    <div className={`bg-white border-y border-r border-gray-200 p-3 ${colors[color] ?? colors.blue}`}>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{title}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-2xl font-bold text-gray-900 font-mono tracking-tight">{value}</p>
          {Icon && <Icon className="w-5 h-5 text-gray-400" strokeWidth={2.5} />}
        </div>
        {sub && <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">{sub}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------
export function Spinner({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-blue-500 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CasePriorityBadge
// ---------------------------------------------------------------------------
const PRIORITY_STYLES: Record<number, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-amber-100 text-amber-700 border-amber-200',
  3: 'bg-gray-100 text-gray-600 border-gray-200',
};
const PRIORITY_LABELS: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' };

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={`text-[10px] tracking-wider uppercase font-bold px-1.5 py-0.5 rounded-sm border
      ${PRIORITY_STYLES[priority] ?? PRIORITY_STYLES[3]}`}>
      {PRIORITY_LABELS[priority] ?? 'Unknown'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge (case status)
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, string> = {
  OPEN:       'bg-blue-100  text-blue-700',
  IN_REVIEW:  'bg-amber-100 text-amber-700',
  RESOLVED:   'bg-green-100 text-green-700',
  ESCALATED:  'bg-red-100   text-red-700',
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-[10px] tracking-wider uppercase font-bold px-1.5 py-0.5 rounded-sm
      ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
export function EmptyState({ title, description, icon: Icon }: {
  title: string; description?: string; icon?: React.FC<any>;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-10 h-10 text-gray-300 mb-3" />}
      <p className="font-medium text-gray-500">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
  );
}
