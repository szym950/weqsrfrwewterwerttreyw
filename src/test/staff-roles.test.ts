import { describe, expect, it } from "vitest";
import { canAccessOrders, canEditMenu, isStaffRole } from "@/lib/staff-roles";

describe("staff permissions", () => {
  it.each([
    ["administrator", true, true],
    ["menu_editor", false, true],
    ["orders", true, false],
  ] as const)("assigns %s access correctly", (role, orders, menu) => {
    expect(canAccessOrders(role)).toBe(orders);
    expect(canEditMenu(role)).toBe(menu);
  });

  it("rejects unknown role names", () => {
    expect(isStaffRole("owner")).toBe(false);
  });
});
