import React from 'react';

export const BackgroundDecorations: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute left-6 top-28 hidden max-w-[240px] rotate-[-8deg] font-mono text-xs leading-6 text-white/[0.055] md:block">
      <pre>{`function dfs(node) {
  if (!node) return;
  visit(node.value);
  dfs(node.left);
  dfs(node.right);
}`}</pre>
    </div>

    <svg className="absolute right-4 top-24 hidden h-52 w-52 text-white/[0.06] md:block" viewBox="0 0 220 220" fill="none">
      <circle cx="110" cy="28" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="58" cy="104" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="162" cy="104" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="34" cy="180" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="86" cy="180" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="134" cy="180" r="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="186" cy="180" r="18" stroke="currentColor" strokeWidth="2" />
      <path d="M100 43L68 89M120 43L152 89M53 121L40 163M64 121L80 163M157 121L140 163M168 121L180 163" stroke="currentColor" strokeWidth="2" />
    </svg>

    <div className="absolute bottom-20 left-8 hidden font-mono text-6xl font-black text-white/[0.04] lg:block">{'{ }'}</div>
    <div className="absolute bottom-16 right-10 hidden grid grid-cols-5 gap-2 text-white/[0.05] lg:grid">
      {[5, 1, 9, 3, 7].map((value) => (
        <div key={value} className="flex h-10 w-10 items-center justify-center rounded-lg border border-current font-mono text-xs">
          {value}
        </div>
      ))}
    </div>
    <div className="absolute right-24 top-1/2 hidden font-mono text-sm leading-7 text-white/[0.045] xl:block">
      <div>[stack] push pop peek</div>
      <div>dp[i] = min(dp[i-1], dp[i-2])</div>
      <div>queue.offer(node)</div>
    </div>
  </div>
);

