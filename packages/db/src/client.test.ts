import { getTableColumns, getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase, fluxoMeta } from "./index.js";

const { postgresMock, queryMock } = vi.hoisted(() => {
  const queryMock = Object.assign(vi.fn().mockResolvedValue([{ "?column?": 1 }]), {
    options: {
      parsers: {},
      serializers: {},
    },
  });
  const postgresMock = vi.fn(() => queryMock);
  return { postgresMock, queryMock };
});

vi.mock("postgres", () => ({
  default: postgresMock,
}));

describe("createDatabase", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    queryMock.mockClear();
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("creates a drizzle client from the configured url", () => {
    const result = createDatabase({ url: "postgres://localhost/fluxo" });
    expect(postgresMock).toHaveBeenCalledWith("postgres://localhost/fluxo");
    expect(result.db).toBeDefined();
    expect(result.client).toBe(queryMock);
    expect(typeof result.ping).toBe("function");
  });

  it("pings through the mocked postgres client", async () => {
    const { ping } = createDatabase({ url: "postgres://localhost/fluxo" });
    await ping();
    expect(queryMock).toHaveBeenCalled();
  });
});

describe("schema", () => {
  it("defines the fluxo_meta table", () => {
    expect(getTableName(fluxoMeta)).toBe("fluxo_meta");
    const columns = getTableColumns(fluxoMeta);
    expect(columns.key).toBeDefined();
    expect(columns.value).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });
});
