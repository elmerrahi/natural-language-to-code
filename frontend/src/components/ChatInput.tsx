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
    `rounded-lg border px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-all ${
      mode === m
        ? "border-cyan-300/25 bg-gradient-to-r from-cyan-300/10 to-violet-400/10 text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        : "border-transparent text-muted hover:bg-white/[0.025] hover:text-foreground"
    }`;

  return (
    <div className="glass-panel z-10 border-x-0 border-b-0 p-4 md:px-7 md:py-5">
      <div className="mb-2.5 flex gap-1">
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

      <div className="flex items-end gap-2 rounded-2xl border border-cyan-300/15 bg-[#030817]/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),0_0_32px_rgba(67,231,255,0.025)] focus-within:border-cyan-300/35">
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
          className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
        />

        {streaming ? (
          <button
            onClick={onStop}
            className="shrink-0 rounded-xl border border-red-400/25 bg-red-500/15 px-4 py-2.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="neon-button grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          >
            <span className="sr-only">Send</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 12 14-7-4.5 14-3-5.5L5 12Zm6.5 1.5L19 5" />
            </svg>
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between px-1 font-mono text-[9px] uppercase tracking-widest text-slate-600">
        <span>Enter to transmit · Shift + Enter for newline</span>
        <span>Encrypted channel</span>
      </div>
    </div>
  );
}
