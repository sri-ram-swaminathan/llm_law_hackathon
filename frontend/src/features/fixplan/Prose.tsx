import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components: Components = {
  h1: ({ node: _n, ...p }) => <h1 className="mb-3 text-2xl font-semibold tracking-[-0.01em] text-text" {...p} />,
  h2: ({ node: _n, ...p }) => <h2 className="mb-3 mt-1 text-lg font-semibold text-text" {...p} />,
  h3: ({ node: _n, ...p }) => <h3 className="mb-2 mt-5 text-xs font-medium uppercase tracking-[0.04em] text-text-2" {...p} />,
  p: ({ node: _n, ...p }) => <p className="my-2 leading-relaxed text-text" {...p} />,
  strong: ({ node: _n, ...p }) => <strong className="font-semibold text-text" {...p} />,
  a: ({ node: _n, ...p }) => <a className="text-accent underline-offset-2 hover:underline" target="_blank" rel="noreferrer" {...p} />,
  ul: ({ node: _n, className, ...p }) => (
    <ul className={cn("my-2 space-y-1 pl-5 text-text", className?.includes("contains-task-list") ? "list-none pl-0" : "list-disc marker:text-text-3")} {...p} />
  ),
  ol: ({ node: _n, ...p }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-text marker:text-text-3" {...p} />,
  li: ({ node: _n, className, ...p }) => <li className={cn("leading-relaxed", className?.includes("task-list-item") && "flex items-start gap-2")} {...p} />,
  input: ({ node: _n, ...p }) => <input {...p} className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]" readOnly />,
  blockquote: ({ node: _n, ...p }) => (
    <blockquote className="my-3 rounded-md border bg-surface-2 px-4 py-2 text-sm text-text-2 [&_p]:my-1 [&_p]:text-text-2 [&_strong]:text-text" {...p} />
  ),
  hr: () => <hr className="my-5 border-t" />,
  code: ({ node: _n, className, ...p }) => (
    <code className={cn("rounded-sm border bg-surface-2 px-1 py-px font-mono text-code text-text", className)} {...p} />
  ),
  pre: ({ node: _n, ...p }) => <pre className="my-3 overflow-x-auto rounded-md border bg-surface-2 p-3 font-mono text-code [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0" {...p} />,
  table: ({ node: _n, ...p }) => (
    <div className="my-3 overflow-x-auto rounded-md border">
      <table className="w-full min-w-[34rem] border-collapse text-sm" {...p} />
    </div>
  ),
  thead: ({ node: _n, ...p }) => <thead className="bg-surface-2 text-left text-xs uppercase tracking-[0.04em] text-text-2" {...p} />,
  th: ({ node: _n, ...p }) => <th className="border-b px-3 py-2 font-medium" {...p} />,
  td: ({ node: _n, ...p }) => <td className="border-t px-3 py-2 align-top leading-relaxed" {...p} />,
};

export function Prose({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 text-sm", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children}</ReactMarkdown>
    </div>
  );
}
