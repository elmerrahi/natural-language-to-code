"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "@/lib/types";

interface Props {
  message: Message;
}

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-cyan-300/15 bg-black/20">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-gradient-to-r from-cyan-300/[0.055] to-violet-400/[0.035] px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-cyan-100"
      >
        <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        SQL Query
        <svg
          className={`w-3 h-3 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <pre className="overflow-x-auto border-t border-cyan-300/10 bg-[#020611] p-4 font-mono text-xs leading-relaxed text-cyan-50/80">
          {sql}
        </pre>
      )}
    </div>
  );
}

function ResultsTable({ results }: { results: Record<string, unknown>[] }) {
  if (!results.length) return <p className="text-xs text-muted italic">No results</p>;
  const cols = Object.keys(results[0]);
  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-violet-300/15 bg-black/20">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gradient-to-r from-violet-400/[0.09] to-cyan-300/[0.05]">
            {cols.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider text-violet-100/70">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t border-white/[0.045] transition-colors hover:bg-cyan-300/[0.025]">
              {cols.map((c) => (
                <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-300">
                  {String(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 20 && (
        <p className="px-3 py-2 text-xs text-muted border-t border-border">
          Showing 20 of {results.length} rows
        </p>
      )}
    </div>
  );
}

export default function MessageBubble({ message }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md border border-cyan-200/20 bg-gradient-to-br from-cyan-400/25 to-violet-500/25 px-4 py-3 text-sm leading-relaxed text-cyan-50 shadow-[0_8px_30px_rgba(67,231,255,0.08)]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-3">
      <div className="mt-1 hidden h-7 w-7 shrink-0 place-items-center rounded-lg border border-violet-300/20 bg-violet-400/[0.08] text-violet-200 sm:grid">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12M7.76 16.24l-2.12 2.12M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
        </svg>
      </div>
      <div className="max-w-[88%] space-y-1">
        {message.sql && <SqlBlock sql={message.sql} />}
        {message.results && message.results.length > 0 && (
          <ResultsTable results={message.results} />
        )}
        {message.content && (
          <div className="prose prose-invert prose-sm max-w-none rounded-2xl rounded-tl-md border border-white/[0.055] bg-[#0a1022]/60 px-4 py-3 text-sm leading-relaxed text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children, ...props }) => (
                  <div className="my-2 overflow-x-auto rounded-lg border border-cyan-300/15">
                    <table className="w-full text-xs" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children, ...props }) => (
                  <th className="whitespace-nowrap bg-cyan-300/[0.055] px-3 py-2 text-left font-medium text-muted" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="whitespace-nowrap border-t border-white/[0.05] px-3 py-1.5 text-slate-300" {...props}>
                    {children}
                  </td>
                ),
                code: ({ children, className, ...props }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="overflow-x-auto rounded-lg border border-cyan-300/10 bg-[#020611] p-3 text-xs">
                        <code className="text-cyan-50/80" {...props}>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="rounded bg-cyan-300/[0.08] px-1.5 py-0.5 font-mono text-xs text-cyan-200" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
