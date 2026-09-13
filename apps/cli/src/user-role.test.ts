import type { FluxoLogger } from "@fluxo/logger";
import { UserRole } from "@fluxo/types";
import { describe, expect, it, vi } from "vitest";
import { handleUserRole, parseUserRole, type UserRoleUi } from "./user-role.js";

function mockLogger(): FluxoLogger {
  const logger: FluxoLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function mockUi(overrides?: Partial<UserRoleUi>): UserRoleUi {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    isCancel: (value: unknown): value is symbol => typeof value === "symbol",
    text: vi.fn().mockResolvedValue("ada"),
    selectRole: vi.fn().mockResolvedValue(UserRole.Admin),
    confirm: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("parseUserRole", () => {
  it("accepts user and admin", () => {
    expect(parseUserRole("user")).toBe(UserRole.User);
    expect(parseUserRole("ADMIN")).toBe(UserRole.Admin);
    expect(parseUserRole("owner")).toBeNull();
  });
});

describe("handleUserRole", () => {
  it("updates a role through the injected writer after confirm", async () => {
    const logger = mockLogger();
    const updateRole = vi.fn().mockResolvedValue({
      id: "1",
      username: "ada",
      email: "ada@example.com",
      role: UserRole.Admin,
    });
    const ui = mockUi();

    const result = await handleUserRole({
      logger,
      user: "ada@example.com",
      role: "admin",
      updateRole,
      ui,
    });

    expect(result).toEqual({
      status: "ok",
      username: "ada",
      email: "ada@example.com",
      role: UserRole.Admin,
    });
    expect(updateRole).toHaveBeenCalledWith("ada@example.com", UserRole.Admin);
    expect(logger.info).toHaveBeenCalledWith("user role updated", {
      username: "ada",
      role: UserRole.Admin,
    });
    expect(ui.outro).toHaveBeenCalledWith("Set ada to admin");
  });

  it("prompts for missing user and role", async () => {
    const logger = mockLogger();
    const updateRole = vi.fn().mockResolvedValue({
      id: "1",
      username: "ada",
      email: "ada@example.com",
      role: UserRole.User,
    });
    const ui = mockUi({
      text: vi.fn().mockResolvedValue("ada"),
      selectRole: vi.fn().mockResolvedValue(UserRole.User),
    });

    await handleUserRole({ logger, updateRole, ui });

    expect(ui.text).toHaveBeenCalledWith("Username or email");
    expect(ui.selectRole).toHaveBeenCalledWith("Role");
    expect(updateRole).toHaveBeenCalledWith("ada", UserRole.User);
  });

  it("does not write when confirmation is declined", async () => {
    const logger = mockLogger();
    const updateRole = vi.fn();
    const ui = mockUi({ confirm: vi.fn().mockResolvedValue(false) });

    const result = await handleUserRole({
      logger,
      user: "ada",
      role: "admin",
      updateRole,
      ui,
    });

    expect(result).toEqual({ status: "cancelled" });
    expect(updateRole).not.toHaveBeenCalled();
    expect(ui.cancel).toHaveBeenCalledWith("Cancelled");
  });

  it("rejects an invalid role argument", async () => {
    const logger = mockLogger();
    const updateRole = vi.fn();
    const ui = mockUi();

    const result = await handleUserRole({
      logger,
      user: "ada",
      role: "owner",
      updateRole,
      ui,
    });

    expect(result).toEqual({ status: "error", message: "Role must be user or admin" });
    expect(updateRole).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Role must be user or admin");
  });

  it("logs update failures", async () => {
    const logger = mockLogger();
    const updateRole = vi.fn().mockRejectedValue(new Error("User not found"));
    const ui = mockUi();

    const result = await handleUserRole({
      logger,
      user: "missing",
      role: "user",
      updateRole,
      ui,
    });

    expect(result).toEqual({ status: "error", message: "User not found" });
    expect(logger.error).toHaveBeenCalledWith("User not found");
  });
});
