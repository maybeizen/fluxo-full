export interface EncryptedPayload {
  iv: string;
  tag: string;
  ciphertext: string;
}
