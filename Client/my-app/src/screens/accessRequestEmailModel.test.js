import {
  canApplicantRequestAccess,
  isUdecProfessorEmail,
  normalizeAccessRequestEmail,
} from "./accessRequestEmailModel";


describe("access request email model", () => {
  test.each([
    "profesor@udec.cl",
    "profesor@inf.udec.cl",
    "profesor@sub.inf.udec.cl",
    "  Profesor@INF.UDEC.CL  ",
  ])(
    "accepts a valid UdeC professor email: %s",
    (value) => {
      expect(
        isUdecProfessorEmail(value)
      ).toBe(true);
    }
  );

  test.each([
    "profesor@gmail.com",
    "profesor@eviludec.cl",
    "profesor@udec.cl.evil.com",
    "profesor@@inf.udec.cl",
    "profesor@.udec.cl",
    "profesor@foo..udec.cl",
    "profesor@",
    "@inf.udec.cl",
  ])(
    "rejects a non-institutional or malformed professor email: %s",
    (value) => {
      expect(
        isUdecProfessorEmail(value)
      ).toBe(false);
    }
  );

  test("normalizes applicant email before applying the existing policy", () => {
    expect(
      canApplicantRequestAccess(
        "alumno@udec.cl"
      )
    ).toBe(true);
    expect(
      canApplicantRequestAccess(
        "  Alumno@UDEC.CL  "
      )
    ).toBe(true);
    expect(
      normalizeAccessRequestEmail(
        "  Alumno@UDEC.CL  "
      )
    ).toBe("alumno@udec.cl");
  });

  test("preserves direct-login policy for @inf.udec.cl applicants", () => {
    expect(
      canApplicantRequestAccess(
        "alumno@inf.udec.cl"
      )
    ).toBe(false);
  });

  test("rejects non-UdeC applicant email", () => {
    expect(
      canApplicantRequestAccess(
        "alumno@gmail.com"
      )
    ).toBe(false);
  });

  test("rejects malformed applicant email ending in @udec.cl", () => {
    expect(
      canApplicantRequestAccess(
        "persona@@udec.cl"
      )
    ).toBe(false);
  });
});
