export type ChatMode = "generate" | "explain" | "optimize";

export interface SchemaColumn {
  name: string;
  data_type: string;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  results?: Record<string, unknown>[];
}

export type DataSource =
  | {
      type: "csv";
      tablesSchemaXml: string;
      tables: SchemaTable[];
    }
  | {
      type: "connection";
      connectionId: string;
      tables: SchemaTable[];
    };
