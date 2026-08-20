import {
  translate,
} from "../i18n";

import {
  coursePeriod,
  formatDateTime,
  pluralize,
  teacherRequestErrorMessage,
} from "./teacherApi";


const tEn = (key, params) =>
  translate(
    "en",
    key,
    params
  );


describe("teacherApi i18n foundation", () => {
  test("keeps legacy helpers backward compatible", () => {
    expect(
      coursePeriod({
        academicYear: 2026,
        academicTerm: 2,
      })
    ).toBe("2026-2");

    expect(
      coursePeriod(null)
    ).toBe("—");

    expect(
      pluralize(
        1,
        "estudiante",
        "estudiantes"
      )
    ).toBe("1 estudiante");

    expect(
      pluralize(
        2,
        "estudiante",
        "estudiantes"
      )
    ).toBe("2 estudiantes");
  });

  test("formats dates with caller locale and fallback", () => {
    expect(
      formatDateTime(
        "invalid",
        "en-US",
        "Unavailable"
      )
    ).toBe("Unavailable");

    const english =
      formatDateTime(
        "2026-08-20T12:00:00Z",
        "en-US",
        "Unavailable"
      );

    const spanish =
      formatDateTime(
        "2026-08-20T12:00:00Z",
        "es-CL",
        "No disponible"
      );

    expect(english).not.toBe(
      "Unavailable"
    );
    expect(spanish).not.toBe(
      "No disponible"
    );
    expect(english).not.toBe(spanish);
  });

  test("localizes stable request boundaries without leaking backend Spanish", () => {
    expect(
      teacherRequestErrorMessage(
        {
          code: "NETWORK_ERROR",
          message:
            "No pudimos conectar con el servidor.",
        },
        tEn
      )
    ).toBe(
      "Could not connect to the server. Check that the backend is available and try again."
    );

    expect(
      teacherRequestErrorMessage(
        {
          status: 403,
          message:
            "Tu cuenta no tiene permisos.",
        },
        tEn
      )
    ).toBe(
      "Your account does not have permission to perform this action."
    );

    expect(
      teacherRequestErrorMessage(
        {
          status: 500,
          message:
            "Error interno del servidor.",
        },
        tEn
      )
    ).toBe(
      "The service is temporarily unavailable. Try again in a few moments."
    );

    expect(
      teacherRequestErrorMessage(
        {
          status: 409,
          code: "COURSE_ALREADY_EXISTS",
          message:
            "Ya existe una instancia académica.",
        },
        tEn
      )
    ).toBe(
      "The requested information could not be loaded."
    );
  });

  test("supports screen-owned business code mappings and preserves legacy mode", () => {
    expect(
      teacherRequestErrorMessage(
        {
          status: 409,
          code: "COURSE_ALREADY_EXISTS",
        },
        tEn,
        {
          codeKeys: {
            COURSE_ALREADY_EXISTS:
              "teacherCommon.errors.notFound",
          },
        }
      )
    ).toBe(
      "The requested information is not available."
    );

    expect(
      teacherRequestErrorMessage({
        status: 500,
        message:
          "No fue posible cargar los cursos.",
      })
    ).toBe(
      "No fue posible cargar los cursos."
    );
  });

  test("AbortError stays silent", () => {
    expect(
      teacherRequestErrorMessage(
        {
          name: "AbortError",
        },
        tEn
      )
    ).toBe("");
  });
});
