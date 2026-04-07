/**
 * Role-based permissions for admin team members.
 *
 * Roles:
 * - owner: full access to everything
 * - sales: CRM (contacts/companies), outreach, sales analytics, view orders
 * - fulfillment: orders (update tracking, shipping)
 * - support: tickets, customer chat
 * - content: knowledge base, articles, products
 */

export type Role = "owner" | "sales" | "fulfillment" | "support" | "content";

export type Permission =
  | "admin.access"          // any access to /admin/*
  | "products.read"
  | "products.write"
  | "crm.read"              // contacts + companies
  | "crm.write"
  | "outreach.read"
  | "outreach.write"
  | "orders.read"
  | "orders.write"          // update status, tracking
  | "tickets.read"
  | "tickets.write"
  | "knowledge.read"
  | "knowledge.write"
  | "chat.access"           // admin AI chat
  | "system.usage"
  | "team.manage";          // manage team members

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    "admin.access",
    "products.read", "products.write",
    "crm.read", "crm.write",
    "outreach.read", "outreach.write",
    "orders.read", "orders.write",
    "tickets.read", "tickets.write",
    "knowledge.read", "knowledge.write",
    "chat.access",
    "system.usage",
    "team.manage",
  ],
  sales: [
    "admin.access",
    "products.read",
    "crm.read", "crm.write",
    "outreach.read", "outreach.write",
    "orders.read",
    "tickets.read",
    "chat.access",
  ],
  fulfillment: [
    "admin.access",
    "orders.read", "orders.write",
    "products.read",
  ],
  support: [
    "admin.access",
    "tickets.read", "tickets.write",
    "chat.access",
    "crm.read",
    "knowledge.read",
  ],
  content: [
    "admin.access",
    "knowledge.read", "knowledge.write",
    "products.read", "products.write",
    "chat.access",
  ],
};

export const ALL_ROLES: Role[] = ["owner", "sales", "fulfillment", "support", "content"];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  sales: "Sales",
  fulfillment: "Fulfillment",
  support: "Support",
  content: "Content",
};

export function getRolePermissions(role: Role | null | undefined): Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as Role] || [];
}

export function roleHasPermission(role: Role | null | undefined, permission: Permission): boolean {
  return getRolePermissions(role).includes(permission);
}

export function isValidRole(role: string): role is Role {
  return ALL_ROLES.includes(role as Role);
}
