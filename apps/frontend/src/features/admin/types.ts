import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListResponse,
} from "@fluxo/types";
import { UserRole } from "@fluxo/types";

export type { AdminUserDetail, AdminUserListItem, AdminUserListResponse };
export { UserRole };

export interface AdminCreateUserInput {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  emailVerified?: boolean;
}

export interface AdminPatchUserInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  dateOfBirth?: string | null;
  company?: string | null;
  role?: UserRole;
  emailVerified?: boolean;
  password?: string;
  suspended?: boolean;
  suspendedReason?: string | null;
}
