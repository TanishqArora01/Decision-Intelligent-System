'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Brain, Building2, GitBranch, Layers, Radio, Shield } from 'lucide-react';
import { containerVariants, itemVariants } from '@/lib/animations';

const FEATURES = [
  { icon: Shield, title: 'Sub-millisecond decisioning', desc: 'Stage-1 early exit and cost-optimized routing at banking scale.' },
  { icon: Brain, title: 'Explainable AI copilot', desc: 'SSE-streamed investigations with SHAP-style feature narratives.' },
  { icon: Radio, title: 'Real-time Redpanda streaming', desc: 'Durable event mesh with partition lag observability built in.' },
  { icon: GitBranch, title: 'Multi-stage rules engine', desc: 'Velocity, geo, graph, and ML policies with shadow deployment.' },
  { icon: Layers, title: 'Shadow deployment testing', desc: 'Run policies on live traffic without affecting production decisions.' },
  { icon: Building2, title: 'Role-based bank workspaces', desc: 'Multi-tenant isolation with admin, analyst, and ops RBAC.' },
];

function FeatureCard({ icon: Icon, title, desc }: (typeof FEATURES)[0]) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]));
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]));

  return (
    <motion.div
      variants={itemVariants}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileHover={{ y: -2 }}
      className="gradient-border surface-card p-6"
    >
      <Icon className="mb-4 h-5 w-5 text-brand-primary" />
      <h3 className="text-subheading">{title}</h3>
      <p className="mt-2 text-body text-text-secondary">{desc}</p>
    </motion.div>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-content px-6 py-24">
      <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <motion.p variants={itemVariants} className="metric-label text-brand-primary">
          Platform
        </motion.p>
        <motion.h2 variants={itemVariants} className="mt-2 text-display">
          Built for mission-critical risk operations
        </motion.h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
