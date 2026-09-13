import { defaultComponents } from "./defaults";

export type UIComponents = typeof defaultComponents;

export type UIOverrides = Partial<UIComponents>;
