import type React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

interface MarkdownSolutionRendererProps {
  content: string;
}

export const MarkdownSolutionRenderer: React.FC<MarkdownSolutionRendererProps> = ({ content }) => (
  <div className="prose prose-invert max-w-none text-sm leading-7 text-slate-200 prose-headings:tracking-normal prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-code:rounded-md prose-code:bg-white/[0.08] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-yellow-100 prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-white/[0.12] prose-pre:bg-[#081229]/80 prose-table:text-slate-300 prose-th:border prose-th:border-white/[0.12] prose-th:bg-white/[0.06] prose-td:border prose-td:border-white/[0.12]">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {content}
    </ReactMarkdown>
  </div>
);
