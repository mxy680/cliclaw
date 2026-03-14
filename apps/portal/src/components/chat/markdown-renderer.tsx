"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-p:text-foreground/90 prose-headings:text-foreground prose-headings:font-mono prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border/50 prose-strong:text-amber/90 prose-a:text-amber prose-a:no-underline hover:prose-a:underline prose-table:text-xs prose-th:text-amber/80 prose-th:font-mono prose-th:border-border/50 prose-td:border-border/30 prose-hr:border-border/30 prose-li:text-foreground/80">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
