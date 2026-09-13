export class DatabaseConfigError extends Error {
  override readonly name = "DatabaseConfigError";

  constructor(message = "Postgres URL is required") {
    super(message);
  }
}

export class DatabasePingError extends Error {
  override readonly name = "DatabasePingError";

  constructor(message = "Postgres ping failed") {
    super(message);
  }
}
