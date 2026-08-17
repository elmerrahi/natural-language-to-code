"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Message, DataSource, ChatMode } from "@/lib/types";
import { getChatStreamUrl } from "@/lib/api";
import { streamSSE } from "@/lib/sse";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";

interface Props {
  apiKey: string;
  dataSource: DataSource | null;
}

function generateId() {
  return crypto.randomUUID();
}

export default function ChatWindow({ apiKey, dataSource }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userIdRef = useRef(generateId());
  const threadIdRef = useRef(generateId());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (content: string, mode: ChatMode) => {
      if (!apiKey || !dataSource) return;

      const userMsg: Message = { id: generateId(), role: "user", content };
      const assistantMsg: Message = { id: generateId(), role: "assistant", content: "" };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setError("");

      const controller = new AbortController();
      abortRef.current = controller;

      const body: Record<string, unknown> = { content, mode };
      if (dataSource.type === "connection") {
        body.connection_id = dataSource.connectionId;
      } else {
        body.tables_schema_xml = dataSource.tablesSchemaXml;
      }

      const url = getChatStreamUrl(userIdRef.current, threadIdRef.current);

      let currentText = "";
      let currentSql = "";
      let currentResults: Record<string, unknown>[] = [];
      let blockType = "";
      let toolInputBuffer = "";

      try {
        for await (const event of streamSSE(url, body, apiKey, controller.signal)) {
          const parsed = JSON.parse(event.data);

          switch (event.event) {
            case "block-start": {
              blockType = typeof parsed === "string" ? parsed : String(parsed);
              if (blockType === "tool-input") {
                toolInputBuffer = "";
              }
              break;
            }
            case "text": {
              const delta = typeof parsed === "string" ? parsed : String(parsed);
              currentText += delta;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: currentText,
                    sql: currentSql || undefined,
                    results: currentResults.length ? currentResults : undefined,
                  };
                }
                return updated;
              });
              break;
            }
            case "tool-input": {
              const delta = typeof parsed === "string" ? parsed : String(parsed);
              toolInputBuffer += delta;
              break;
            }
            case "tool-output": {
              const outputStr = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
              try {
                const toolResult = JSON.parse(outputStr);
                if (toolResult.results) {
                  currentResults = toolResult.results;
                }
              } catch {
                // non-JSON tool output
              }
              break;
            }
            case "block-end": {
              if (blockType === "tool-input" && toolInputBuffer) {
                try {
                  const toolInput = JSON.parse(toolInputBuffer);
                  if (toolInput.query) {
                    currentSql = toolInput.query;
                  }
                } catch {
                  // malformed tool input JSON
                }
              }
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: currentText,
                    sql: currentSql || undefined,
                    results: currentResults.length ? currentResults : undefined,
                  };
                }
                return updated;
              });
              blockType = "";
              break;
            }
            case "error": {
              const errMsg = parsed.error || "An error occurred";
              setError(errMsg);
              break;
            }
            case "complete":
              break;
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError(e instanceof Error ? e.message : "Stream failed");
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [apiKey, dataSource]
  );

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleNewChat = () => {
    setMessages([]);
    setError("");
    threadIdRef.current = generateId();
  };

  const isReady = !!apiKey && !!dataSource;

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="glass-panel z-10 flex items-center justify-between border-x-0 border-t-0 px-5 py-3.5 md:px-7">
        <div className="flex items-center gap-3">
          <div className="hidden h-8 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent sm:block" />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-300/55">Neural query console</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "status-pulse" : "bg-slate-600"}`} />
              <span className="text-xs text-slate-300">
                {!apiKey
                  ? "Awaiting intelligence key"
                  : !dataSource
                  ? "Awaiting data uplink"
                  : "Systems ready"}
              </span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-cyan-300/25 hover:text-cyan-200"
          >
            New sequence
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        {messages.length === 0 && (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
            <div className="hero-orbit mb-7">
              <svg className="h-10 w-10 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 7.5C4 5.567 7.582 4 12 4s8 1.567 8 3.5S16.418 11 12 11 4 9.433 4 7.5Zm0 0v4C4 13.433 7.582 15 12 15s8-1.567 8-3.5v-4m-16 4v4C4 17.433 7.582 19 12 19s8-1.567 8-3.5v-4" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="m9 7.5 2 1.5 4-3" />
              </svg>
            </div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-violet-300/70">Language becomes logic</p>
            <h2 className="gradient-text text-3xl font-semibold tracking-[-0.035em] md:text-4xl">Query at the speed of thought.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              {isReady
                ? "Your data is synchronized. Ask naturally, inspect the generated SQL, and explore the results."
                : "Complete the two secure setup steps to connect your intelligence layer and data source."}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {(isReady
                ? ["Top 10 records", "Summarize the dataset", "Find unusual patterns"]
                : ["01 · Add API key", "02 · Connect data", "03 · Start querying"]
              ).map((hint) => (
                <span key={hint} className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.035] px-3 py-1.5 font-mono text-[10px] text-slate-400">
                  {hint}
                </span>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && (
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cyan-300/70">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span> Processing stream
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <ChatInput
        onSend={handleSend}
        disabled={!isReady}
        streaming={streaming}
        onStop={handleStop}
      />
    </div>
  );
}
