export class ForgeError extends Error {
  override readonly name: string = "ForgeError";
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class ForgeValidationError extends ForgeError {
  override readonly name = "ForgeValidationError";

  constructor(message: string) {
    super("forge_validation", message, 400);
  }
}

export class ForgeManifestError extends ForgeError {
  override readonly name = "ForgeManifestError";

  constructor(message: string) {
    super("forge_manifest", message, 400);
  }
}

export class ForgePermissionError extends ForgeError {
  override readonly name = "ForgePermissionError";

  constructor(permission: string) {
    super("forge_permission", `Missing plugin permission: ${permission}`, 403);
  }
}

export class ForgeNotFoundError extends ForgeError {
  override readonly name = "ForgeNotFoundError";

  constructor(resource: string) {
    super("forge_not_found", `Not found: ${resource}`, 404);
  }
}

export class ForgeConflictError extends ForgeError {
  override readonly name = "ForgeConflictError";

  constructor(message: string) {
    super("forge_conflict", message, 409);
  }
}

export class ForgeTimeoutError extends ForgeError {
  override readonly name = "ForgeTimeoutError";

  constructor(message = "Plugin operation timed out") {
    super("forge_timeout", message, 504);
  }
}

export class ForgeHttpError extends ForgeError {
  override readonly name = "ForgeHttpError";

  constructor(message: string, status = 502) {
    super("forge_http", message, status);
  }
}

export class ForgeConfigError extends ForgeError {
  override readonly name = "ForgeConfigError";

  constructor(message: string) {
    super("forge_config", message, 400);
  }
}

export class ForgeUnsupportedApiError extends ForgeError {
  override readonly name = "ForgeUnsupportedApiError";

  constructor(range: string, version: string) {
    super(
      "forge_unsupported_api",
      `Plugin forgeApi ${range} is not satisfied by Forge ${version}`,
      409,
    );
  }
}

export function forgeErrorBody(error: ForgeError): {
  error: string;
  code: string;
} {
  return { error: error.message, code: error.code };
}
