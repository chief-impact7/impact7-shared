export interface PermissionUser {
  role?: unknown;
  permissions?: Record<string, unknown>;
}

export interface PermissionCatalogItem {
  key: string;
  label: string;
  apps: string[];
  enforced: 'rules' | 'client' | 'none';
}

export interface PermissionCatalogList {
  id: string;
  label: string;
  children: PermissionCatalogEntry[];
}

export type PermissionCatalogEntry = PermissionCatalogItem | PermissionCatalogList;

export interface PermissionCatalogGroup {
  key: string;
  title: string;
  items: PermissionCatalogEntry[];
}

export const PERMISSION_GROUPS: PermissionCatalogGroup[];
export const ALL_PERMISSION_KEYS: string[];
export const SENSITIVE_PERMISSION_KEYS: string[];
export type PermissionStaffRole = 'member' | 'manager' | 'supervisor' | 'director';
export function canManageStaffPermissions(role: unknown): boolean;
export function canManageStaffRole(actorRole: unknown, targetRole: unknown): boolean;
export function hasPermission(user: PermissionUser | null | undefined, permission: string): boolean;
export function hasAppAccess(user: PermissionUser | null | undefined, permission: string): boolean;
export function hasRequestPermission(user: PermissionUser | null | undefined, permission: string): boolean;
export function canCreateLeaveRequest(user: PermissionUser | null | undefined): boolean;
export function canEditLeaveRequest(user: PermissionUser | null | undefined, isAuthor: boolean): boolean;
