"use client";

import { useState } from "react";
import { DataSource } from "@/lib/types";
import ApiKeyInput from "./ApiKeyInput";
import CsvUpload from "./CsvUpload";
import ConnectionForm from "./ConnectionForm";
import SchemaViewer from "./SchemaViewer";

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onDataSourceReady: (ds: DataSource | null) => void;
}

type Tab = "csv" | "database";

export default function SetupPanel({
  apiKey,
  onApiKeyChange,
  onDataSourceReady,
}: Props) {
  const [tab, setTab] = useState<Tab>("csv");
  const [dataSource, setDataSource] = useState<DataSource | null>(null);

  const handleDataSource = (ds: DataSource) => {
    setDataSource(ds);
    onDataSourceReady(ds);
  };

  const handleReset = () => {
    setDataSource(null);
    onDataSourceReady(null);
  };

  const tabCls = (t: Tab) =>
    `flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
      tab === t
        ? "border border-cyan-300/20 bg-gradient-to-r from-cyan-400/12 to-violet-500/12 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        : "border border-transparent text-muted hover:bg-white/[0.03] hover:text-foreground"
    }`;

  return (
    <div className="space-y-4 p-4">
      {/* API Key */}
      <section className="tech-card p-4">
        <div className="section-label mb-3">
          <span className="section-index">01</span>
          Intelligence layer
        </div>
        <ApiKeyInput apiKey={apiKey} onChange={onApiKeyChange} />
      </section>

      {/* Data Source */}
      {apiKey && (
        <section className="tech-card p-4">
          <div className="section-label mb-3">
            <span className="section-index">02</span>
            Data uplink
          </div>

          {dataSource ? (
            <div>
              <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs text-emerald-200">
                  <span className="status-pulse" />
                  {dataSource.type === "csv" ? "CSV synchronized" : "Database online"}
                </span>
                <button
                  onClick={handleReset}
                  className="font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:text-red-300"
                >
                  Disconnect
                </button>
              </div>
              <SchemaViewer tables={dataSource.tables} />
            </div>
          ) : (
            <>
              <div className="mb-3 flex gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                <button className={tabCls("csv")} onClick={() => setTab("csv")}>
                  Upload CSV
                </button>
                <button className={tabCls("database")} onClick={() => setTab("database")}>
                  Connect DB
                </button>
              </div>

              {tab === "csv" ? (
                <CsvUpload apiKey={apiKey} onUploaded={handleDataSource} />
              ) : (
                <ConnectionForm apiKey={apiKey} onConnected={handleDataSource} />
              )}
            </>
          )}
        </section>
      )}
      {!apiKey && (
        <div className="rounded-xl border border-dashed border-violet-400/15 bg-violet-400/[0.025] px-4 py-3 text-xs leading-relaxed text-muted">
          Add your API key to unlock the data uplink and neural query console.
        </div>
      )}
    </div>
  );
}
