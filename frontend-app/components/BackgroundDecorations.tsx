import React from 'react';

const Node: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <>
    <circle cx={x} cy={y} r="16" stroke="currentColor" strokeWidth="2" />
    {label && <text x={x} y={y + 4} textAnchor="middle" className="fill-current text-[10px] font-bold">{label}</text>}
  </>
);

export const BackgroundDecorations: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-70">
      <div className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute right-[8%] top-[46%] h-96 w-96 rounded-full bg-purple-500/12 blur-3xl" />
      <div className="absolute bottom-[8%] left-[28%] h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
    </div>

    <div className="absolute left-6 top-24 hidden max-w-[260px] rotate-[-7deg] font-mono text-xs leading-6 text-white/[0.055] md:block">
      <pre>{`function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return true;
    seen.set(nums[i], i);
  }
}`}</pre>
    </div>

    <div className="absolute left-3 top-[46%] hidden rotate-[-90deg] items-center gap-3 font-mono text-sm font-bold text-white/[0.05] lg:flex">
      {[1, 2, 3, 4].map((value, index) => (
        <React.Fragment key={value}>
          <span className="rounded-full border border-current px-3 py-1">{value}</span>
          {index < 3 && <span>-&gt;</span>}
        </React.Fragment>
      ))}
    </div>

    <svg className="absolute bottom-10 left-4 hidden h-60 w-60 text-white/[0.05] lg:block" viewBox="0 0 220 220" fill="none">
      <Node x={110} y={28} label="8" />
      <Node x={58} y={104} label="3" />
      <Node x={162} y={104} label="10" />
      <Node x={34} y={180} label="1" />
      <Node x={86} y={180} label="6" />
      <Node x={134} y={180} label="9" />
      <Node x={186} y={180} label="14" />
      <path d="M100 43L68 89M120 43L152 89M53 121L40 163M64 121L80 163M157 121L140 163M168 121L180 163" stroke="currentColor" strokeWidth="2" />
    </svg>

    <svg className="absolute right-4 top-20 hidden h-56 w-56 text-white/[0.055] md:block" viewBox="0 0 240 240" fill="none">
      <rect x="72" y="18" width="96" height="36" rx="12" stroke="currentColor" strokeWidth="2" />
      <rect x="20" y="102" width="82" height="36" rx="12" stroke="currentColor" strokeWidth="2" />
      <rect x="138" y="102" width="82" height="36" rx="12" stroke="currentColor" strokeWidth="2" />
      <rect x="72" y="186" width="96" height="36" rx="12" stroke="currentColor" strokeWidth="2" />
      <path d="M120 54V78M120 78H61V102M120 78H179V102M61 138V162H120V186M179 138V162H120" stroke="currentColor" strokeWidth="2" />
      <text x="120" y="41" textAnchor="middle" className="fill-current text-[10px] font-bold">BFS?</text>
      <text x="61" y="125" textAnchor="middle" className="fill-current text-[10px] font-bold">queue</text>
      <text x="179" y="125" textAnchor="middle" className="fill-current text-[10px] font-bold">visit</text>
      <text x="120" y="209" textAnchor="middle" className="fill-current text-[10px] font-bold">done</text>
    </svg>

    <div className="absolute bottom-24 right-8 hidden font-mono text-sm leading-7 text-white/[0.055] lg:block">
      <div>dp[i] = max(dp[i - 1], value + dp[i - 2])</div>
      <div>while (lo &lt; hi) mid = lo + (hi - lo) / 2</div>
      <div>visited.add(`${'${node.id}'}`)</div>
    </div>

    <div className="absolute right-12 top-[58%] hidden w-52 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-3 font-mono text-[10px] leading-5 text-white/[0.055] xl:block">
      <div className="mb-2 flex gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
      </div>
      <div>$ npm run solve</div>
      <div>tests: 42 passed</div>
      <div>complexity: O(n log n)</div>
    </div>

    <div className="absolute bottom-14 right-10 hidden grid grid-cols-6 gap-2 text-white/[0.05] lg:grid">
      {[2, 7, 11, 15, 19, 23].map((value) => (
        <div key={value} className="flex h-10 w-10 items-center justify-center rounded-lg border border-current font-mono text-xs">
          {value}
        </div>
      ))}
    </div>

    <div className="absolute left-[20%] bottom-8 hidden items-end gap-1 text-white/[0.05] xl:flex">
      {[4, 7, 2, 9, 5].map((height, index) => (
        <div key={`${height}-${index}`} className="flex w-10 flex-col items-center gap-1 font-mono text-[10px]">
          <div className="w-full rounded-t-lg border border-current" style={{ height: `${height * 9}px` }} />
          <span>{index}</span>
        </div>
      ))}
    </div>

    <div className="absolute bottom-28 left-[50%] hidden font-mono text-7xl font-black text-white/[0.045] xl:block">{'{ }'}</div>
    <div className="absolute right-[22%] top-28 hidden h-16 w-16 rounded-full border-2 border-white/[0.05] lg:block">
      <div className="absolute left-11 top-11 h-10 w-0.5 rotate-[-45deg] rounded-full bg-white/[0.05]" />
    </div>
  </div>
);
