export class UnsafeStorageKeyError extends Error {
  override readonly name = "UnsafeStorageKeyError";

  constructor(key: string) {
    super(`Unsafe storage key: ${key}`);
  }
}
