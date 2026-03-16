"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface MarkdownContentProps {
  content: string;
  memberNames?: string[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1 rounded bg-neutral-200/80 hover:bg-neutral-300 text-neutral-500 hover:text-neutral-700 transition opacity-0 group-hover:opacity-100"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function MentionTag({ name }: { name: string }) {
  return (
    <span className="mention-tag inline-flex items-center bg-white/20 rounded px-1 py-0.5 font-semibold text-[13px] whitespace-nowrap">
      @{name}
    </span>
  );
}

function renderWithMentions(text: string, memberNames: string[]): React.ReactNode[] {
  if (memberNames.length === 0) return [text];

  const escapedNames = memberNames
    .sort((nameA, nameB) => nameB.length - nameA.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(@(?:${escapedNames.join("|")}))(?=\\s|$|[.,!?])`, "gi");

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    result.push(<MentionTag key={match.index} name={match[1].slice(1)} />);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length > 0 ? result : [text];
}

export function MarkdownContent({ content, memberNames = [] }: MarkdownContentProps) {
  return (
    <div className="prose prose-sm prose-neutral max-w-none [&_pre]:bg-neutral-50 [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:border-b-[3px] [&_pre]:border-b-primary-400 [&_pre]:rounded-lg [&_pre]:relative [&_pre]:group [&_code]:font-mono [&_code]:text-[13px] [&_a]:text-primary-500 [&_a]:no-underline hover:[&_a]:underline [&_table]:text-sm [&_p]:leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-semibold [&_blockquote]:border-l-primary-300 [&_blockquote]:text-neutral-500">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p({ children }) {
            const processed = Array.isArray(children)
              ? children.flatMap((child) =>
                  typeof child === "string" ? renderWithMentions(child, memberNames) : child
                )
              : typeof children === "string"
                ? renderWithMentions(children, memberNames)
                : children;
            return <p>{processed}</p>;
          },
          pre({ children, ...props }) {
            const child = children as React.ReactElement<{ children?: string }>;
            const codeText = child?.props?.children || "";
            return (
              <pre {...props} className="group relative">
                {children}
                <CopyButton text={String(codeText)} />
              </pre>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
