"use client";

import { useState, useCallback } from "react";
import { uploadCsv } from "@/lib/api";
import { DataSource, SchemaTable } from "@/lib/types";

interface Props {
  apiKey: string;
  onUploaded: (ds: DataSource) => void;
}

function parseSchemaXml(xml: string): SchemaTable[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const tables: SchemaTable[] = [];
  for (const tbl of Array.from(doc.querySelectorAll("table"))) {
    const name = tbl.getAttribute("name") || "";
    const columns = Array.from(tbl.querySelectorAll("column")).map((col) => ({
      name: col.getAttribute("name") || "",
      data_type: col.getAttribute("data_type") || "",
    }));
    tables.push({ name, columns });
  }
  return tables;
}

export default function CsvUpload({ apiKey, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const csvFiles = Array.from(files).filter((f) => f.name.endsWith(".csv"));
      if (!csvFiles.length) {
        setError("Please upload .csv files");
        return;
      }
      setError("");
      setUploading(true);
      try {
        const result = await uploadCsv(apiKey, csvFiles);
        const tables = parseSchemaXml(result.tables_schema_xml);
        onUploaded({
          type: "csv",
          tablesSchemaXml: result.tables_schema_xml,
          tables,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [apiKey, onUploaded]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`group cursor-pointer rounded-xl border border-dashed p-6 text-center transition-all ${
          dragging
            ? "border-cyan-300/70 bg-cyan-300/[0.08] shadow-[inset_0_0_28px_rgba(67,231,255,0.06)]"
            : "border-cyan-300/20 bg-black/10 hover:border-violet-300/45 hover:bg-violet-400/[0.04]"
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv";
          input.multiple = true;
          input.onchange = () => {
            if (input.files?.length) handleFiles(input.files);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-cyan-200">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Synchronizing...
          </div>
        ) : (
          <>
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 to-violet-500/10 text-cyan-200 transition-transform group-hover:-translate-y-0.5">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-xs text-slate-300">
              Drop CSV files or <span className="text-cyan-300">browse system</span>
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-slate-600">Multi-file ingestion enabled</p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
