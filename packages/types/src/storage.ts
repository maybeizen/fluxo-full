export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  publicUrlBase?: string;
}

export interface LocalStorageConfig {
  directory: string;
}

export interface StorageConfig {
  s3?: S3Config;
  local?: LocalStorageConfig;
}
