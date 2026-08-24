import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'blue';

const toneStyles: Record<Tone, string> = {
  primary: 'from-[#6FE0D0] to-[#1F9E93]',
  accent: 'from-[#FF8A75] to-[#E24E4E]',
  success: 'from-[#A8D5A2] to-[#6FA97D]',
  warning: 'from-[#F5CE85] to-[#E3A857]',
  danger: 'from-[#F08080] to-[#E24E4E]',
  purple: 'from-[#C4A8D5] to-[#9B6DB0]',
  blue: 'from-[#A8C5F5] to-[#5A8DEE]',
};

interface IconBadgeProps {
  icon: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: { container: 'w-10 h-10', icon: 16 },
  md: { container: 'w-12 h-12', icon: 20 },
  lg: { container: 'w-16 h-16', icon: 28 },
};

export function IconBadge({ icon: Icon, tone = 'primary', size = 'md', className }: IconBadgeProps) {
  const { container, icon: iconSize } = sizeStyles[size];
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-2xl bg-gradient-to-br flex-shrink-0',
        toneStyles[tone],
        container,
        className,
      )}
      style={{
        boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 6px rgba(0,0,0,0.15), 0 6px 12px rgba(0,0,0,0.15)',
      }}
    >
      {/* Glossy highlight */}
      <div className="absolute top-1 left-1 w-3 h-3 rounded-full bg-white/30 blur-[2px]" />
      <Icon size={iconSize} className="text-white relative z-10" strokeWidth={2} />
    </div>
  );
}
