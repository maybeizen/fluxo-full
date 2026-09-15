import { ForgeError, ForgeNotFoundError } from "@fluxo/forge";

export class PluginNotFoundError extends ForgeNotFoundError {
  override readonly name = "PluginNotFoundError";

  constructor(id: string) {
    super(`plugin ${id}`);
  }
}

export class PluginNotLoadableError extends ForgeError {
  override readonly name = "PluginNotLoadableError";

  constructor(id: string) {
    super("forge_not_loadable", `Plugin is not loadable: ${id}`, 409);
  }
}
