export class InvalidEncryptionKeyError extends Error {
  override readonly name = "InvalidEncryptionKeyError";

  constructor(message = "Encryption key must be 32 bytes (hex or base64)") {
    super(message);
  }
}
