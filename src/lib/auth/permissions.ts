import type { Role } from "@prisma/client";

const ROLE_HIERARCHY: Record<Role, number> = {
  GUEST: 0,
  USER: 1,
  MODERATOR: 2,
  ADMIN: 3,
};

export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isAdmin(role: Role): boolean {
  return role === "ADMIN";
}

export function isModerator(role: Role): boolean {
  return role === "MODERATOR" || role === "ADMIN";
}

export function canModerate(role: Role): boolean {
  return isModerator(role);
}

export function canAccessAdmin(role: Role): boolean {
  return isAdmin(role);
}

export const ROLE_LABELS: Record<Role, string> = {
  GUEST: "Guest",
  USER: "Registered User",
  MODERATOR: "Moderator",
  ADMIN: "Administrator",
};
