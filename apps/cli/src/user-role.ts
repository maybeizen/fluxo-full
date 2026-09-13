import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import { createDatabase } from "@fluxo/db";
import type { FluxoLogger } from "@fluxo/logger";
import { UserRole } from "@fluxo/types";

export interface UpdatedUserRole {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export type UpdateUserRoleFn = (user: string, role: UserRole) => Promise<UpdatedUserRole>;

export interface UserRoleUi {
  intro(message: string): void;
  outro(message: string): void;
  cancel(message: string): void;
  text(message: string): Promise<string | symbol>;
  selectRole(message: string): Promise<UserRole | symbol>;
  confirm(message: string): Promise<boolean | symbol>;
  isCancel(value: unknown): value is symbol;
}

export type HandleUserRoleResult =
  | { status: "ok"; username: string; email: string; role: UserRole }
  | { status: "cancelled" }
  | { status: "error"; message: string };

const roles = new Set<string>([UserRole.User, UserRole.Admin]);

export function parseUserRole(value: string | undefined): UserRole | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return roles.has(normalized) ? (normalized as UserRole) : null;
}

export function createClackUserRoleUi(): UserRoleUi {
  return {
    intro,
    outro,
    cancel,
    isCancel,
    async text(message) {
      return text({
        message,
        validate(value) {
          return (value ?? "").trim() === "" ? "Required" : undefined;
        },
      });
    },
    async selectRole(message) {
      return select({
        message,
        options: [
          { value: UserRole.User, label: "user" },
          { value: UserRole.Admin, label: "admin" },
        ],
      });
    },
    async confirm(message) {
      return confirm({ message, initialValue: false });
    },
  };
}

export async function updateUserRole(
  identifier: string,
  role: UserRole,
  env: NodeJS.ProcessEnv = process.env,
): Promise<UpdatedUserRole> {
  const database = createDatabase({ url: env.POSTGRES_URL ?? "" });
  try {
    const normalized = identifier.trim().toLowerCase();
    const found = await database.client<
      { id: string; username: string; email: string; role: string }[]
    >`
      select id, username, email, role
      from users
      where lower(email) = ${normalized} or lower(username) = ${normalized}
      limit 1
    `;
    const row = found[0];
    if (!row) {
      throw new Error("User not found");
    }

    const updated = await database.client<
      { id: string; username: string; email: string; role: string }[]
    >`
      update users
      set role = ${role}, updated_at = now()
      where id = ${row.id}
      returning id, username, email, role
    `;
    const next = updated[0];
    if (!next) {
      throw new Error("User not found");
    }

    return {
      id: next.id,
      username: next.username,
      email: next.email,
      role: next.role === UserRole.Admin ? UserRole.Admin : UserRole.User,
    };
  } finally {
    await database.client.end({ timeout: 5 });
  }
}

export async function handleUserRole(options: {
  logger: FluxoLogger;
  user?: string;
  role?: string;
  updateRole: UpdateUserRoleFn;
  ui?: UserRoleUi;
}): Promise<HandleUserRoleResult> {
  const ui = options.ui ?? createClackUserRoleUi();
  ui.intro("Change a user's role");

  let identifier = options.user?.trim() ?? "";
  if (identifier === "") {
    const answered = await ui.text("Username or email");
    if (ui.isCancel(answered)) {
      ui.cancel("Cancelled");
      return { status: "cancelled" };
    }
    identifier = answered.trim();
  }

  if (identifier === "") {
    const message = "User is required";
    options.logger.error(message);
    ui.cancel(message);
    return { status: "error", message };
  }

  let role = parseUserRole(options.role);
  if (options.role !== undefined && options.role.trim() !== "" && role === null) {
    const message = "Role must be user or admin";
    options.logger.error(message);
    ui.cancel(message);
    return { status: "error", message };
  }
  if (role === null) {
    const answered = await ui.selectRole("Role");
    if (ui.isCancel(answered)) {
      ui.cancel("Cancelled");
      return { status: "cancelled" };
    }
    role = answered;
  }

  const confirmed = await ui.confirm(`Set ${identifier} to ${role}?`);
  if (ui.isCancel(confirmed)) {
    ui.cancel("Cancelled");
    return { status: "cancelled" };
  }
  if (!confirmed) {
    ui.cancel("Cancelled");
    return { status: "cancelled" };
  }

  try {
    const updated = await options.updateRole(identifier, role);
    options.logger.info("user role updated", { username: updated.username, role: updated.role });
    ui.outro(`Set ${updated.username} to ${updated.role}`);
    return {
      status: "ok",
      username: updated.username,
      email: updated.email,
      role: updated.role,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    options.logger.error(message);
    ui.cancel(message);
    return { status: "error", message };
  }
}
