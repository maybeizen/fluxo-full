import "@testing-library/jest-dom/vitest";
import { beforeEach, vi } from "vitest";
import * as api from "@/lib/api";

beforeEach(() => {
  vi.spyOn(api, "getApiUrl").mockReturnValue(undefined);
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
