interface GmailMessagePayload {
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: Array<{ body?: { data?: string } }>;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  payload: GmailMessagePayload;
  internalDate?: string;
}

interface NormalizedMessage {
  id: string;
  threadId: string;
  snippet?: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  internalDate: number | null;
}

export function normalizeMessage(msg: GmailMessage): NormalizedMessage {
  const headers: Record<string, string> = (msg.payload.headers || []).reduce(
    (acc: Record<string, string>, h: { name: string; value: string }) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    },
    {}
  );

  const bodyData =
    msg.payload.body?.data || msg.payload.parts?.[0]?.body?.data || null;

  let decodedBody = "";
  if (bodyData) {
    decodedBody = Buffer.from(bodyData, "base64").toString("utf8");
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet,
    from: headers["from"] || "",
    to: headers["to"] || "",
    subject: headers["subject"] || "",
    date: headers["date"] || "",
    body: decodedBody,
    internalDate: msg.internalDate ? Number(msg.internalDate) : null,
  };
}