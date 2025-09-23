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
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono truncate text-muted">
          {apiKey.slice(0, 12)}{"•".repeat(8)}
        </div>
        <button
          onClick={() => {
            setDraft(apiKey);
            setEditing(true);
          }}
          className="shrink-0 text-xs text-muted hover:text-foreground transition-colors"
        >
          Edit
        </button>
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
      className="flex gap-2"
    >
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="sk-..."
        className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono placeholder:text-zinc-600 focus:outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="shrink-0 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
      >
        Save
      </button>
    </form>
  );
}
