export enum UserRole {
  User = "user",
  Admin = "admin",
}

export enum AuthTokenType {
  EmailConfirm = "email_confirm",
  PasswordReset = "password_reset",
}

export type AvatarSource = "upload" | "gravatar" | "none";

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  avatarSource: AvatarSource;
  dateOfBirth: string | null;
  company: string | null;
  role: UserRole;
  emailVerified: boolean;
  mfaEnabled: boolean;
  hasPasskey: boolean;
  suspended: boolean;
  suspendedReason: string | null;
  createdAt: string;
}

export interface AdminUserListItem {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  mfaEnabled: boolean;
  hasPasskey: boolean;
  createdAt: string;
  suspended: boolean;
}

export interface AdminUserPasskey {
  name: string;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  avatarSource: AvatarSource;
  dateOfBirth: string | null;
  company: string | null;
  role: UserRole;
  emailVerified: boolean;
  mfaEnabled: boolean;
  hasPasskey: boolean;
  passkeys: AdminUserPasskey[];
  createdAt: string;
  lastActiveAt: string | null;
  suspended: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

export interface AdminUserListResponse {
  users: AdminUserListItem[];
}

export interface SessionUser extends PublicUser {
  mfaVerified: boolean;
}

export interface AuthMeResponse {
  user: PublicUser;
}

export type LoginResponse =
  | { user: PublicUser; requiresMfa?: false }
  | { requiresMfa: true };
