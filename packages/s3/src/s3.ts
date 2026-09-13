import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { S3Config } from "@fluxo/types";
import { assertSafeKey } from "./keys.js";
import type { StorageDriver } from "./types.js";

export function createS3Storage(config: S3Config): StorageDriver {
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle ?? config.endpoint !== undefined,
    credentials:
      config.accessKeyId !== undefined && config.secretAccessKey !== undefined
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });

  return {
    async put(key, body, contentType) {
      assertSafeKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key, size: body.byteLength, contentType };
    },
    async get(key) {
      assertSafeKey(key);
      const response = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new Error(`Object not found: ${key}`);
      }
      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    },
    async delete(key) {
      assertSafeKey(key);
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
    },
  };
}
