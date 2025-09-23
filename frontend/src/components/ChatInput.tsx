"use client";

import { useState, useRef } from "react";
import { ChatMode } from "@/lib/types";

interface Props {
  onSend: (content: string, mode: ChatMode) => void;
  disabled: boolean;
  streaming: boolean;
  onStop: () => void;
}

export default function ChatInput({ onSend, disabled, streaming, onStop }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("generate");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, mode);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const modeBtnCls = (m: ChatMode) =>
    `px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
      mode === m
        ? "bg-accent/15 text-accent"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="flex gap-1 mb-2">
        <button className={modeBtnCls("generate")} onClick={() => setMode("generate")}>
          Generate
        </button>
        <button className={modeBtnCls("explain")} onClick={() => setMode("explain")}>
          Explain
        </button>
        <button className={modeBtnCls("optimize")} onClick={() => setMode("optimize")}>
          Optimize
        </button>
      </div>

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={
            mode === "generate"
              ? "Ask a question about your data..."
              : mode === "explain"
              ? "Paste SQL to explain..."
              : "Paste SQL to optimize..."
          }
          disabled={disabled && !streaming}
          rows={1}
          className="flex-1 resize-none px-3 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-zinc-600 focus:outline-none focus:border-accent disabled:opacity-50"
        />

        {streaming ? (
          <button
            onClick={onStop}
            className="shrink-0 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="shrink-0 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-30 transition-colors"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
