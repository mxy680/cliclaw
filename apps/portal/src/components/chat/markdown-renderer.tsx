"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded border border-border/40">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-amber/5 border-b border-border/40">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-mono text-amber/80 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-foreground/80 border-t border-border/20">
      {children}
    </td>
  ),
  tr: ({ children }) => (
    <tr className="hover:bg-white/[0.02]">{children}</tr>
  ),
  hr: () => (
    <hr className="my-4 border-border/30" />
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-mono font-semibold text-foreground mt-5 mb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-mono font-semibold text-amber/90 mt-4 mb-1.5">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 pl-4 space-y-0.5 list-disc marker:text-amber/40">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 pl-4 space-y-0.5 list-decimal marker:text-amber/40">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-foreground/80 text-sm">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="text-amber/90 font-semibold">{children}</strong>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={`${className} text-xs`}>{children}</code>
      );
    }
    return (
      <code className="text-amber/80 bg-amber/5 px-1 py-0.5 rounded-sm text-xs font-mono">
        {children}
      </code>
    );
  },
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:text-foreground/90 prose-pre:bg-black/30 prose-pre:border prose-pre:border-border/50 prose-a:text-amber prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
