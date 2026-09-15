import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ForgeValidationError } from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafePluginIdInput,
  resolvePluginDirectory,
  resolvePluginEntryFile,
} from "./paths.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-plugin-paths-"));
  dirs.push(dir);
  return dir;
}

describe("assertSafePluginIdInput", () => {
  it("accepts canonical plugin ids", () => {
    expect(assertSafePluginIdInput("demo")).toBe("demo");
    expect(assertSafePluginIdInput("acme.pterodactyl")).toBe(
      "acme.pterodactyl",
    );
  });

  it("rejects traversal, absolute, URL-like, null-byte, and Windows ids", () => {
    const invalid = [
      "..",
      "../etc",
      "/etc/passwd",
      "foo/bar",
      "foo\\bar",
      "C:\\Windows",
      "C:Windows",
      "\\\\unc\\share",
      "https://evil.example",
      "file:///tmp/x",
      "node:fs",
      "demo\0hidden",
      "__proto__",
      "InvalidId",
      "",
    ];
    for (const value of invalid) {
      expect(() => assertSafePluginIdInput(value)).toThrow(
        ForgeValidationError,
      );
    }
  });
});

describe("resolvePluginDirectory", () => {
  it("resolves a canonical id under the plugins root", async () => {
    const root = await tempDir();
    const resolved = resolvePluginDirectory(root, "acme.demo");
    expect(resolved).toBe(path.resolve(root, "acme.demo"));
    expect(path.relative(path.resolve(root), resolved)).toBe("acme.demo");
  });

  it("rejects ids that would escape the plugins root", () => {
    const root = path.resolve("/tmp/fluxo-plugins-root");
    expect(() => resolvePluginDirectory(root, "../etc")).toThrow(
      ForgeValidationError,
    );
    expect(() => resolvePluginDirectory(root, "/absolute")).toThrow(
      ForgeValidationError,
    );
  });
});

describe("resolvePluginEntryFile", () => {
  it("resolves a relative entry inside the plugin root", async () => {
    const root = await tempDir();
    const pluginRoot = path.join(root, "demo");
    await mkdir(path.join(pluginRoot, "dist"), { recursive: true });
    const entry = path.join(pluginRoot, "dist", "index.js");
    await writeFile(entry, "export default {}\n", "utf8");
    const resolved = await resolvePluginEntryFile(pluginRoot, "dist/index.js");
    expect(resolved).toBe(await realpath(entry));
  });

  it("rejects traversal, absolute, and missing entries", async () => {
    const root = await tempDir();
    const pluginRoot = path.join(root, "demo");
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      path.join(pluginRoot, "index.js"),
      "export default {}\n",
      "utf8",
    );
    await expect(
      resolvePluginEntryFile(pluginRoot, "../secret.js"),
    ).rejects.toBeInstanceOf(ForgeValidationError);
    await expect(
      resolvePluginEntryFile(pluginRoot, "/etc/passwd"),
    ).rejects.toBeInstanceOf(ForgeValidationError);
    await expect(
      resolvePluginEntryFile(pluginRoot, "missing.js"),
    ).rejects.toBeInstanceOf(ForgeValidationError);
  });

  it("rejects a symlink that escapes the plugin root", async () => {
    const root = await tempDir();
    const pluginRoot = path.join(root, "demo");
    await mkdir(pluginRoot, { recursive: true });
    const outside = path.join(root, "secret.js");
    await writeFile(outside, "export default {}\n", "utf8");
    await symlink(outside, path.join(pluginRoot, "link.js"));
    await expect(
      resolvePluginEntryFile(pluginRoot, "link.js"),
    ).rejects.toBeInstanceOf(ForgeValidationError);
  });
});
