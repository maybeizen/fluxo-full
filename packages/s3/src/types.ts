export interface StoredObject {
  key: string;
  size: number;
  contentType?: string;
}

export interface StorageDriver {
  put(key: string, body: Buffer, contentType?: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
