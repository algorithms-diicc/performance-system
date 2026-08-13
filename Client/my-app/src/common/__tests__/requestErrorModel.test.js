import {
  friendlyRequestError,
  requestJson,
} from "../requestErrorModel";

describe("requestErrorModel", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("convierte fallos de red en un mensaje comprensible", () => {
    expect(friendlyRequestError(new TypeError("Failed to fetch"))).toMatch(
      /conectar con el servidor/i
    );
  });

  test("no expone el mensaje interno de una respuesta 500", () => {
    const error = {
      status: 500,
      payload: {
        error: {
          message: "psycopg2.OperationalError: connection refused",
        },
      },
    };

    const message = friendlyRequestError(error);

    expect(message).toMatch(/temporalmente/i);
    expect(message).not.toMatch(/psycopg2|connection refused/i);
  });

  test("mantiene una validación de negocio 400", () => {
    expect(
      friendlyRequestError({
        status: 400,
        payload: {
          error: { message: "El ZIP no contiene archivos .cpp." },
        },
      })
    ).toBe("El ZIP no contiene archivos .cpp.");
  });

  test("descarta HTML aunque el servidor lo entregue como error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token <")),
    });

    await expect(requestJson("/api/test")).rejects.toThrow(
      /temporalmente/i
    );
  });
});
