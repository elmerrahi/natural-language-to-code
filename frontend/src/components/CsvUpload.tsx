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
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-accent bg-accent/5"
            : "border-border hover:border-zinc-500"
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
          <div className="flex items-center justify-center gap-2 text-muted">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading...
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 mx-auto mb-2 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-muted">
              Drop CSV files here or <span className="text-accent">browse</span>
            </p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
