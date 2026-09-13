import type { FluxoLogger } from "@fluxo/logger";

export interface HealthFetchResponse {
  status: number;
  text(): Promise<string>;
}

export type HealthFetch = (url: string) => Promise<HealthFetchResponse>;

export interface RunHealthOptions {
  logger: FluxoLogger;
  apiUrl?: string;
  fetchFn?: HealthFetch;
}

export async function runHealth(options: RunHealthOptions): Promise<void> {
  options.logger.info("local process", {
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
    node: process.version,
  });

  const apiUrl = options.apiUrl !== undefined ? options.apiUrl : process.env.API_URL;
  if (!apiUrl?.trim()) {
    return;
  }

  const url = `${apiUrl.replace(/\/+$/, "")}/health`;
  try {
    const response = await (options.fetchFn ?? fetch)(url);
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
    options.logger.info("api health", { url, status: response.status, body });
  } catch (error) {
    options.logger.error(error instanceof Error ? error.message : "api health check failed", { url });
  }
}
