"use client";

import { useState, useCallback } from "react";
import { DataSource } from "@/lib/types";
import SetupPanel from "@/components/SetupPanel";
import ChatWindow from "@/components/ChatWindow";

export default function Home() {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sql-agent-api-key") || "";
    }
    return "";
  });
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("sql-agent-api-key", key);
    }
  }, []);

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-3 left-3 z-50 md:hidden rounded-lg bg-card border border-border p-2 text-muted hover:text-foreground transition-colors"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
          />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed md:static inset-y-0 left-0 z-40 w-80 border-r border-border bg-card flex flex-col transition-transform md:translate-x-0`}
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-semibold tracking-tight">SQL Agent</h1>
          <p className="text-xs text-muted mt-0.5">
            Ask questions about your data
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SetupPanel
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            onDataSourceReady={setDataSource}
          />
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWindow apiKey={apiKey} dataSource={dataSource} />
      </main>
    </div>
  );
}
