import React from 'react';
import { LucideIcon } from 'lucide-react';
import { IconBadge } from './IconBadge';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'blue';
  sub?: string;
}

export function StatCard({ label, value, icon, tone = 'primary', sub }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card p-5 flex items-center gap-4"
    >
      <IconBadge icon={icon} tone={tone} size="lg" />
      <div>
        <p className="text-slate-500 text-sm">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}
