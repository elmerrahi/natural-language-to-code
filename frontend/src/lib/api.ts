const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1/api";

interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema_name?: string;
}

interface CreateConnectionBody {
  name: string;
  connector_type: "postgres" | "mysql";
  config: ConnectionConfig;
}

interface CreateConnectionResponse {
  id: string;
  schema_xml?: string;
}

interface UploadCsvResponse {
  tables_schema_xml: string;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : JSON.stringify(body.detail ?? body);
    return new Error(detail);
  } catch {
    return new Error(`Request failed (${response.status})`);
  }
}

export async function createConnection(
  apiKey: string,
  body: CreateConnectionBody
): Promise<CreateConnectionResponse> {
  const response = await fetch(`${API_BASE_URL}/connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await responseError(response);
  return (await response.json()) as CreateConnectionResponse;
}

export async function uploadCsv(
  apiKey: string,
  files: File[]
): Promise<UploadCsvResponse> {
  const form = new FormData();
  for (const file of files) form.append("files", file);

  const response = await fetch(`${API_BASE_URL}/data/upload`, {
    method: "POST",
    headers: { "X-API-Key": apiKey },
    body: form,
  });

  if (!response.ok) throw await responseError(response);
  return (await response.json()) as UploadCsvResponse;
}

export function getChatStreamUrl(userId: string, threadId: string): string {
  return `${API_BASE_URL}/stream/${encodeURIComponent(userId)}/${encodeURIComponent(threadId)}`;
}
