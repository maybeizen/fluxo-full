import { ForgeError } from "@fluxo/forge";

export class PluginNotFoundError extends ForgeError {
  override readonly name = "PluginNotFoundError";

  constructor(id: string) {
    super("forge_not_found", `Not found: plugin ${id}`, 404);
  }
}

export class PluginNotLoadableError extends ForgeError {
  override readonly name = "PluginNotLoadableError";

  constructor(id: string) {
    super("forge_not_loadable", `Plugin is not loadable: ${id}`, 409);
  }
}
