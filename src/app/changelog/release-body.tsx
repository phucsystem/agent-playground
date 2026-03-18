"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ReleaseBody({ content }: { content: string }) {
  return (
    <div className="text-sm text-neutral-600 space-y-2 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-neutral-700 [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-neutral-700 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-neutral-700 [&_h3]:mt-2 [&_h3]:mb-1 [&_a]:text-primary-500 [&_a]:no-underline hover:[&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-0.5 [&_li]:text-sm [&_p]:leading-relaxed [&_code]:text-xs [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-neutral-50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-neutral-200 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-500">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
