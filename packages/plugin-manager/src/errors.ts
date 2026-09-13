export class PluginNotFoundError extends Error {
  override readonly name = "PluginNotFoundError";

  constructor(id: string) {
    super(`Plugin not found: ${id}`);
  }
}

export class PluginNotLoadableError extends Error {
  override readonly name = "PluginNotLoadableError";

  constructor(id: string) {
    super(`Plugin is not loadable: ${id}`);
  }
}
