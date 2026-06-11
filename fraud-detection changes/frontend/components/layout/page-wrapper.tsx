'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { pageVariants } from '@/lib/animations';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return <div className="mx-auto w-full max-w-content px-6 py-6">{children}</div>;

  return (
    <motion.div
      className="mx-auto w-full max-w-content px-6 py-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
