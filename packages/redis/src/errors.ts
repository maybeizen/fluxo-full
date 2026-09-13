export class RedisConfigError extends Error {
  override readonly name = "RedisConfigError";

  constructor(message = "Redis URL is required") {
    super(message);
  }
}

export class RedisPingError extends Error {
  override readonly name = "RedisPingError";

  constructor(message = "Redis ping failed") {
    super(message);
  }
}
