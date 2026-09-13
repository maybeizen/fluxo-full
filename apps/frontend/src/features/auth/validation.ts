const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}

export function requiredText(value: string): boolean {
  return value.trim().length > 0;
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation && password.length > 0;
}

export function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
