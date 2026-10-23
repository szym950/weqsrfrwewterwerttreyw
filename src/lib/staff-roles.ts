export type StaffRole = "administrator" | "menu_editor" | "orders";

export function isStaffRole(role: string): role is StaffRole {
  return role === "administrator" || role === "menu_editor" || role === "orders";
}

export function canAccessOrders(role: StaffRole | null): boolean {
  return role === "administrator" || role === "orders";
}

export function canEditMenu(role: StaffRole | null): boolean {
  return role === "administrator" || role === "menu_editor";
}
