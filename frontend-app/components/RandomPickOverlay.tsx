import React from 'react';
import type { Question } from '../types';
import { DifficultyBadge } from './appUi';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface RandomPickOverlayProps {
  randomPick: Question | null;
  onClose: () => void;
}

export const RandomPickOverlay: React.FC<RandomPickOverlayProps> = ({ randomPick, onClose }) => {
  if (!randomPick) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-8 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
      <Card className="relative w-full max-w-md overflow-hidden rounded-[3rem] border-emerald-500/30 bg-[#0f172a]/60 p-10 text-center shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <div className="absolute left-0 top-0 h-1 w-full bg-emerald-500" />
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-[1.8rem] border border-emerald-500/20 bg-emerald-500/20 text-emerald-400 md:h-20 md:w-20">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <p className="mb-3 text-[9px] font-black uppercase tracking-[0.4em] text-emerald-500">Objective Acquired</p>
        <h3 className="mb-6 text-2xl font-black leading-snug tracking-tight text-white">{randomPick.title}</h3>
        <div className="mb-10 flex items-center justify-center gap-3">
          <DifficultyBadge diff={randomPick.difficulty} />
          <Badge variant="outline" className="rounded-xl border-slate-800 bg-slate-900/80 px-3 py-1.5 font-mono text-[10px] font-black text-slate-400">LC #{randomPick.id}</Badge>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild className="rounded-[1.8rem] bg-emerald-600 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-95">
            <a href={randomPick.link} target="_blank" rel="noreferrer" onClick={onClose}>
              Launch LeetCode
            </a>
          </Button>
          <Button variant="ghost" onClick={onClose} className="py-4 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-transparent hover:text-slate-300">
            Dismiss
          </Button>
        </div>
      </Card>
    </div>
  );
};
