import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStorage, createUploadMiddleware, UnsafeStorageKeyError } from "./index.js";

describe("createStorage", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "fluxo-s3-"));
    dirs.push(dir);
    return dir;
  }

  it("selects local storage when S3 config is missing", async () => {
    const directory = await tempDir();
    const storage = createStorage({ local: { directory } });
    const body = Buffer.from("hello fluxo");
    const stored = await storage.put("notes/hello.txt", body, "text/plain");
    expect(stored).toEqual({ key: "notes/hello.txt", size: body.byteLength, contentType: "text/plain" });
    expect(await storage.get("notes/hello.txt")).toEqual(body);
    await storage.delete("notes/hello.txt");
    await expect(storage.get("notes/hello.txt")).rejects.toThrow();
  });

  it("rejects path traversal on put, get, and delete", async () => {
    const directory = await tempDir();
    const storage = createStorage({ local: { directory } });
    const body = Buffer.from("nope");
    await expect(storage.put("../secret", body)).rejects.toBeInstanceOf(UnsafeStorageKeyError);
    await expect(storage.put("/etc/passwd", body)).rejects.toBeInstanceOf(UnsafeStorageKeyError);
    await expect(storage.get("..\\win")).rejects.toBeInstanceOf(UnsafeStorageKeyError);
    await expect(storage.delete("/abs/path")).rejects.toBeInstanceOf(UnsafeStorageKeyError);
  });

  it("rejects traversal before talking to S3", async () => {
    const storage = createStorage({
      s3: { bucket: "fluxo", region: "us-east-1" },
    });
    await expect(storage.put("../escape", Buffer.from("x"))).rejects.toBeInstanceOf(
      UnsafeStorageKeyError,
    );
  });
});

describe("createUploadMiddleware", () => {
  it("returns a multer instance for local and S3 configs", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "fluxo-s3-upload-"));
    try {
      const local = createUploadMiddleware({ local: { directory } });
      const remote = createUploadMiddleware({
        s3: { bucket: "fluxo", region: "us-east-1" },
      });
      expect(typeof local.single).toBe("function");
      expect(typeof remote.single).toBe("function");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
