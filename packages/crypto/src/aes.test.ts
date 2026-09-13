import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, generateKey, InvalidEncryptionKeyError } from "./index.js";

describe("crypto", () => {
  it("round-trips plaintext with a generated key", () => {
    const key = generateKey();
    const plaintext = "fluxo secret payload";
    expect(decrypt(encrypt(plaintext, key), key)).toBe(plaintext);
  });

  it("round-trips with a base64 key", () => {
    const key = randomBytes(32).toString("base64");
    expect(decrypt(encrypt("hello", key), key)).toBe("hello");
  });

  it("fails to decrypt with the wrong key", () => {
    const payload = encrypt("classified", generateKey());
    expect(() => decrypt(payload, generateKey())).toThrow();
  });

  it("rejects invalid key lengths", () => {
    expect(() => encrypt("x", "short")).toThrow(InvalidEncryptionKeyError);
    expect(() => encrypt("x", randomBytes(16).toString("hex"))).toThrow(InvalidEncryptionKeyError);
    expect(() => decrypt(encrypt("x", generateKey()), "not-a-key")).toThrow(
      InvalidEncryptionKeyError,
    );
  });

  it("uses a unique IV for each encryption", () => {
    const key = generateKey();
    const first = encrypt("same", key);
    const second = encrypt("same", key);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("generates a 32-byte key", () => {
    expect(Buffer.from(generateKey(), "hex")).toHaveLength(32);
  });
});
