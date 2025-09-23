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
    <div className="my-2 rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
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
        <pre className="p-3 text-xs font-mono overflow-x-auto bg-zinc-950 text-zinc-300 leading-relaxed">
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
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-zinc-900">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-medium text-muted whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-t border-border hover:bg-zinc-900/50">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 whitespace-nowrap text-zinc-300">
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
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-accent text-white text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        {message.sql && <SqlBlock sql={message.sql} />}
        {message.results && message.results.length > 0 && (
          <ResultsTable results={message.results} />
        )}
        {message.content && (
          <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-zinc-200">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-2 rounded-lg border border-border">
                    <table className="w-full text-xs" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children, ...props }) => (
                  <th className="px-3 py-2 text-left font-medium text-muted bg-zinc-900 whitespace-nowrap" {...props}>
                    {children}
                  </th>
                ),
                td: ({ children, ...props }) => (
                  <td className="px-3 py-1.5 border-t border-border whitespace-nowrap text-zinc-300" {...props}>
                    {children}
                  </td>
                ),
                code: ({ children, className, ...props }) => {
                  const isBlock = className?.includes("language-");
                  if (isBlock) {
                    return (
                      <pre className="p-3 rounded-lg bg-zinc-950 overflow-x-auto text-xs">
                        <code className="text-zinc-300" {...props}>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-accent text-xs font-mono" {...props}>
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
