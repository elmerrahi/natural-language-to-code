export interface ServerSentEvent {
  event: string;
  data: string;
}

function parseEvent(block: string): ServerSentEvent | null {
  let event = "message";
  const data: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trimStart();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }

  return data.length ? { event, data: data.join("\n") } : null;
}

export async function* streamSSE(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  signal?: AbortSignal
): AsyncGenerator<ServerSentEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Stream request failed (${response.status})`);
  }
  if (!response.body) throw new Error("Stream response has no body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const parsed = parseEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }

      if (done) break;
    }

    const parsed = parseEvent(buffer);
    if (parsed) yield parsed;
  } finally {
    reader.releaseLock();
  }
}
