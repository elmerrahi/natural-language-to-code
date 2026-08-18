"use client";

import { useState } from "react";
import { SchemaTable } from "@/lib/types";

interface Props {
  tables: SchemaTable[];
}

export default function SchemaViewer({ tables }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!tables.length) return null;

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="mb-2 flex items-center justify-between font-mono text-[10px] font-medium uppercase tracking-wider text-muted">
        <span>Schema map</span><span className="text-cyan-300">{tables.length} tables</span>
      </p>
      {tables.map((table) => (
        <div key={table.name} className="overflow-hidden rounded-lg border border-white/[0.04] bg-black/10">
          <button
            onClick={() => toggle(table.name)}
            className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-sm transition-colors hover:bg-cyan-300/[0.035]"
          >
            <svg
              className={`w-3 h-3 text-muted transition-transform ${
                expanded.has(table.name) ? "rotate-90" : ""
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <svg className="w-4 h-4 text-accent/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
            </svg>
            <span className="font-mono text-xs truncate">{table.name}</span>
            <span className="ml-auto rounded-md bg-violet-400/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-violet-200">{table.columns.length}</span>
          </button>
          {expanded.has(table.name) && (
            <div className="mb-1 ml-7 space-y-0.5 border-l border-cyan-300/10 pl-1">
              {table.columns.map((col) => (
                <div
                  key={col.name}
                  className="flex items-center justify-between px-2 py-1 text-xs"
                >
                  <span className="font-mono text-zinc-300 truncate">{col.name}</span>
                  <span className="text-muted shrink-0 ml-2">{col.data_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
