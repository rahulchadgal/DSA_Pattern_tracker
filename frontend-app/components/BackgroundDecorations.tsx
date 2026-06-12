import React from 'react';

const Node: React.FC<{ x: number; y: number; label?: string }> = ({ x, y, label }) => (
  <>
    <circle cx={x} cy={y} r="16" stroke="currentColor" strokeWidth="2" />
    {label && <text x={x} y={y + 4} textAnchor="middle" className="fill-current text-[10px] font-bold">{label}</text>}
  </>
);

export const BackgroundDecorations: React.FC = () => (
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div
      className="absolute inset-0 hidden opacity-30 lg:block"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(192,132,252,0.22) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
        maskImage: 'linear-gradient(90deg, black 0%, transparent 30%, transparent 70%, black 100%)'
      }}
    />
    <div className="absolute inset-0 opacity-70">
      <div className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute right-[8%] top-[46%] h-96 w-96 rounded-full bg-purple-500/12 blur-3xl" />
      <div className="absolute bottom-[8%] left-[28%] h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
    </div>

    <div className="absolute left-6 top-32 hidden max-w-[260px] font-mono text-xs leading-6 text-purple-200/[0.16] lg:block">
      <pre>{`function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    if (seen.has(target - nums[i])) return true;
    seen.set(nums[i], i);
  }
}`}</pre>
    </div>

    <div className="absolute left-8 top-[37%] hidden items-center gap-3 font-mono text-sm font-bold text-purple-200/[0.20] lg:flex">
      {[1, 2, 3, 4].map((value, index) => (
        <React.Fragment key={value}>
          <span className="rounded-full border border-current px-3 py-1">{value}</span>
          {index < 3 && <span>-&gt;</span>}
        </React.Fragment>
      ))}
    </div>

    <div className="absolute left-9 top-[47%] hidden font-mono text-sm text-purple-200/[0.16] lg:block">Array</div>
    <div className="absolute left-9 top-[50%] hidden rounded-lg border border-purple-200/[0.18] px-4 py-2 font-mono text-sm text-purple-200/[0.18] lg:block">[1, 2, 3, 4]</div>

    <div className="absolute left-24 top-[58%] hidden font-mono text-sm text-purple-200/[0.16] lg:block">Stack</div>
    <div className="absolute left-20 top-[62%] hidden space-y-1 text-purple-200/[0.16] lg:block">
      {[3, 2, 1].map((value) => (
        <div key={value} className="h-7 w-16 rounded-md border border-current" />
      ))}
    </div>

    <svg className="absolute bottom-14 left-8 hidden h-48 w-48 text-purple-200/[0.17] lg:block" viewBox="0 0 220 220" fill="none">
      <Node x={110} y={28} label="8" />
      <Node x={58} y={104} label="3" />
      <Node x={162} y={104} label="10" />
      <Node x={34} y={180} label="1" />
      <Node x={86} y={180} label="6" />
      <Node x={134} y={180} label="9" />
      <Node x={186} y={180} label="14" />
      <path d="M100 43L68 89M120 43L152 89M53 121L40 163M64 121L80 163M157 121L140 163M168 121L180 163" stroke="currentColor" strokeWidth="2" />
    </svg>
    <div className="absolute bottom-64 left-12 hidden font-mono text-sm text-purple-200/[0.16] lg:block">Binary Tree</div>

    <div className="absolute right-28 top-32 hidden max-w-[220px] font-mono text-sm leading-7 text-purple-200/[0.16] lg:block">
      <div>for (i = 0; i &lt; n; i++) {'{'}</div>
      <div className="pl-5">for (j = i; j &lt; n; j++) {'{'}</div>
      <div className="pl-10">// ...</div>
      <div className="pl-5">{'}'}</div>
      <div>{'}'}</div>
    </div>

    <div className="absolute right-32 top-[26%] hidden font-mono text-4xl font-black text-purple-200/[0.16] lg:block">&lt;/&gt;</div>

    <svg className="absolute right-6 top-[38%] hidden h-56 w-56 text-purple-200/[0.18] lg:block" viewBox="0 0 240 240" fill="none">
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

    <div className="absolute bottom-24 right-28 hidden font-mono text-sm leading-7 text-purple-200/[0.16] lg:block">
      <div>dp[i] = max(dp[i - 1], value + dp[i - 2])</div>
      <div>while (lo &lt; hi) mid = lo + (hi - lo) / 2</div>
      <div>visited.add(`${'${node.id}'}`)</div>
    </div>

    <div className="absolute right-24 top-[30%] hidden w-52 rounded-xl border border-purple-200/[0.14] bg-white/[0.025] p-3 font-mono text-[10px] leading-5 text-purple-200/[0.16] xl:block">
      <div className="mb-2 flex gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="h-2 w-2 rounded-full bg-white/20" />
      </div>
      <div>$ npm run solve</div>
      <div>tests: 42 passed</div>
      <div>complexity: O(n log n)</div>
    </div>

    <div className="absolute right-10 top-[31%] hidden h-16 w-16 rounded-full border-2 border-purple-200/[0.16] lg:block">
      <div className="absolute left-11 top-11 h-10 w-0.5 rotate-[-45deg] rounded-full bg-purple-200/[0.16]" />
    </div>
  </div>
);
