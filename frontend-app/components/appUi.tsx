import React from 'react';
import { cn } from '../lib/utils';

export const GlobalStatBadge: React.FC<{ diff: string; solved: number; total: number }> = ({ diff, solved, total }) => {
  const styles = {
    Easy: 'text-moss-green-400 border-moss-green-500/25 bg-moss-green-500/10',
    Medium: 'text-light-gold-400 border-light-gold-500/25 bg-light-gold-500/10',
    Hard: 'text-coral-glow-400 border-coral-glow-500/25 bg-coral-glow-500/10'
  };
  const colorClass = styles[diff as keyof typeof styles] || 'text-turquoise-300 border-turquoise-800 bg-turquoise-950';

  return (
    <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-all duration-300', colorClass)}>
      <span className="text-[10px] font-black">{diff[0]}</span>
      <div className="flex items-baseline gap-0.5">
        <span className="font-mono text-xs font-black">{solved}</span>
        <span className="text-[9px] font-bold opacity-40">/{total}</span>
      </div>
    </div>
  );
};

export const DifficultyBadge: React.FC<{ diff: string }> = ({ diff }) => {
  const styles = {
    Easy: 'bg-moss-green-500/10 text-moss-green-400 border-moss-green-500/25',
    Medium: 'bg-light-gold-500/10 text-light-gold-400 border-light-gold-500/25',
    Hard: 'bg-coral-glow-500/10 text-coral-glow-400 border-coral-glow-500/25'
  };

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', styles[diff as keyof typeof styles])}>
      {diff}
    </span>
  );
};

export const WakeBanner: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-light-gold-500/30 bg-light-gold-500/10 px-3 py-2 text-light-gold-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-light-gold-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.15em]">Waking backend... retrying automatically</span>
    </div>
  );
};
