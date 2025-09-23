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
    `flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
      tab === t
        ? "bg-background text-foreground shadow-sm"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <div className="p-4 space-y-5">
      {/* API Key */}
      <section>
        <label className="block text-xs text-muted font-medium uppercase tracking-wider mb-2">
          API Key
        </label>
        <ApiKeyInput apiKey={apiKey} onChange={onApiKeyChange} />
      </section>

      {/* Data Source */}
      {apiKey && (
        <section>
          <label className="block text-xs text-muted font-medium uppercase tracking-wider mb-2">
            Data Source
          </label>

          {dataSource ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-zinc-300">
                  {dataSource.type === "csv" ? "CSV uploaded" : "Database connected"}
                </span>
                <button
                  onClick={handleReset}
                  className="text-xs text-muted hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
              <SchemaViewer tables={dataSource.tables} />
            </div>
          ) : (
            <>
              <div className="flex gap-1 p-1 bg-background rounded-lg mb-3">
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
    </div>
  );
}
