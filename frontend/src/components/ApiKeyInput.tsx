"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onChange: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onChange }: Props) {
  const [editing, setEditing] = useState(!apiKey);
  const [draft, setDraft] = useState(apiKey);

  if (!editing && apiKey) {
    return (
      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] text-emerald-300">
          <span className="status-pulse" /> Secure key active
        </div>
        <div className="flex items-center gap-2">
          <div className="tech-input min-w-0 flex-1 truncate px-3 py-2.5 font-mono text-xs text-slate-400">
            {apiKey.slice(0, 12)}{"•".repeat(8)}
          </div>
          <button
            onClick={() => {
              setDraft(apiKey);
              setEditing(true);
            }}
            className="shrink-0 rounded-lg border border-white/10 px-3 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-cyan-300/30 hover:text-cyan-200"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.trim()) {
          onChange(draft.trim());
          setEditing(false);
        }
      }}
      className="space-y-2"
    >
      <p className="text-[11px] leading-relaxed text-muted">
        Connect your Anthropic intelligence key. It stays in this browser.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-..."
          className="tech-input min-w-0 flex-1 px-3 py-2.5 font-mono text-xs"
        />
        <button type="submit" className="neon-button shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold">
          Save
        </button>
      </div>
    </form>
  );
}
