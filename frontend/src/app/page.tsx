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
    <div className="tech-grid relative flex h-full overflow-hidden">
      <div className="ambient-orb -right-24 -top-28 h-80 w-80 bg-violet-600" />
      <div className="ambient-orb -bottom-28 left-1/3 h-72 w-72 bg-cyan-500 [animation-delay:-3s]" />
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="glass-panel fixed top-3 left-3 z-50 rounded-xl p-2 text-cyan-200 transition-colors hover:text-white md:hidden"
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
        } glass-panel fixed inset-y-0 left-0 z-40 flex w-[22rem] flex-col border-y-0 border-l-0 transition-transform md:static md:translate-x-0`}
      >
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="brand-orb">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4} d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M14 4l-4 16" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.3em] text-cyan-300/70">NL / CODE</p>
              <h1 className="gradient-text truncate text-lg font-semibold tracking-tight">Natural Language to Code</h1>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/5 bg-black/15 px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <span className="status-pulse" /> Local workspace
            </span>
            <span className="font-mono text-[9px] text-violet-300/70">CORE // 01</span>
          </div>
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
          className="fixed inset-0 z-30 bg-[#02040c]/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <ChatWindow apiKey={apiKey} dataSource={dataSource} />
      </main>
    </div>
  );
}
