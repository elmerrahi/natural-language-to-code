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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-400" : "bg-zinc-600"}`}
          />
          <span className="text-sm text-muted">
            {!apiKey
              ? "Enter API key to start"
              : !dataSource
              ? "Upload CSV or connect a database"
              : "Ready"}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewChat}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && isReady && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-12 h-12 text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm text-muted mb-1">Ask a question about your data</p>
            <p className="text-xs text-zinc-600">
              Try: &quot;What are the top 10 rows?&quot; or &quot;Show me a summary&quot;
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
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
