"use client";

import { useState } from "react";
import { createConnection } from "@/lib/api";
import { DataSource, SchemaTable } from "@/lib/types";

interface Props {
  apiKey: string;
  onConnected: (ds: DataSource) => void;
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

export default function ConnectionForm({ apiKey, onConnected }: Props) {
  const [connType, setConnType] = useState<"postgres" | "mysql">("postgres");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(connType === "postgres" ? "5432" : "3306");
  const [database, setDatabase] = useState("");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [schema, setSchema] = useState("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await createConnection(apiKey, {
        name: name || `${connType} connection`,
        connector_type: connType,
        config: {
          host,
          port: parseInt(port, 10),
          database,
          user,
          password,
          ...(connType === "postgres" ? { schema_name: schema } : {}),
        },
      });
      const tables = result.schema_xml ? parseSchemaXml(result.schema_xml) : [];
      onConnected({
        type: "connection",
        connectionId: result.id,
        tables,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "tech-input px-3 py-2 text-xs";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-muted mb-1">Type</label>
        <select
          value={connType}
          onChange={(e) => {
            const t = e.target.value as "postgres" | "mysql";
            setConnType(t);
            setPort(t === "postgres" ? "5432" : "3306");
          }}
          className={inputCls}
        >
          <option value="postgres">PostgreSQL</option>
          <option value="mysql">MySQL</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Name (optional)</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Database" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="block text-xs text-muted mb-1">Host</label>
          <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" required />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Port</label>
          <input className={inputCls} value={port} onChange={(e) => setPort(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Database</label>
        <input className={inputCls} value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="my_database" required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-muted mb-1">User</label>
          <input className={inputCls} value={user} onChange={(e) => setUser(e.target.value)} placeholder="readonly" required />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Password</label>
          <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>

      {connType === "postgres" && (
        <div>
          <label className="block text-xs text-muted mb-1">Schema</label>
          <input className={inputCls} value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="public" />
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="neon-button w-full rounded-lg py-2.5 text-xs font-semibold"
      >
        {loading ? "Establishing uplink..." : "Initialize connection"}
      </button>
    </form>
  );
}
