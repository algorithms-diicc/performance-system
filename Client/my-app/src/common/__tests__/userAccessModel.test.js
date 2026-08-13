import {
  ADMIN_ROLE_ID,
  getRoleId,
  getRoleName,
  isAdminUser,
} from "../userAccessModel";

describe("CORE-05B-2 userAccessModel", () => {
  test("admin role_id canonical", () => {
    expect(ADMIN_ROLE_ID).toBe(2);
    expect(isAdminUser({ role_id: 2 })).toBe(true);
  });

  test("admin roleId camelCase", () => {
    expect(isAdminUser({ roleId: "2" })).toBe(true);
  });

  test("nested role id", () => {
    expect(isAdminUser({ role: { id: 2 } })).toBe(true);
  });

  test("admin by role_name", () => {
    expect(isAdminUser({ role_name: "Admin" })).toBe(true);
  });

  test("admin by nested role name", () => {
    expect(isAdminUser({ role: { name: "Administrador" } })).toBe(true);
  });

  test("student is not admin", () => {
    expect(
      isAdminUser({ role_id: 1, role_name: "Student" })
    ).toBe(false);
  });

  test("unknown user is not admin", () => {
    expect(isAdminUser({})).toBe(false);
    expect(isAdminUser(null)).toBe(false);
  });

  test("helpers normalize values", () => {
    expect(getRoleId({ role_id: "2" })).toBe(2);
    expect(getRoleName({ role_name: " ADMIN " })).toBe("admin");
  });
});
