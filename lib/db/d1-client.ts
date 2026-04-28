type D1ResultRow = Record<string, unknown>;

interface D1QueryResponse {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    error?: string;
    errors?: Array<{ message?: string }>;
    results?: D1ResultRow[];
  }>;
}

function getD1Config() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;
  return { accountId, apiToken, databaseId };
}

export function isD1Configured(): boolean {
  const { accountId, apiToken, databaseId } = getD1Config();
  return Boolean(accountId && apiToken && databaseId);
}

export async function d1Query(sql: string, params: unknown[] = []): Promise<D1ResultRow[]> {
  const { accountId, apiToken, databaseId } = getD1Config();
  if (!accountId || !apiToken || !databaseId) {
    throw new Error("D1 is not configured. Missing CF_ACCOUNT_ID, CF_API_TOKEN, or D1_DATABASE_ID.");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      cache: "no-store",
    }
  );

  const data = (await res.json()) as D1QueryResponse;
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message || `D1 query failed with status ${res.status}`;
    throw new Error(msg);
  }

  const first = data.result?.[0];
  if (!first?.success) {
    const msg = first?.error || first?.errors?.[0]?.message || "D1 query execution failed";
    throw new Error(msg);
  }

  return first.results ?? [];
}
