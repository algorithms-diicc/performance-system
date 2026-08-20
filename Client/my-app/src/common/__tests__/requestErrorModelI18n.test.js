import {
  friendlyRequestError,
  localizedRequestError,
} from "../requestErrorModel";

import {
  translate,
} from "../../i18n/i18nCore";


const tEn = (
  key,
  params
) =>
  translate(
    "en",
    key,
    params
  );

const tEs = (
  key,
  params
) =>
  translate(
    "es",
    key,
    params
  );


describe(
  "requestErrorModel i18n boundary",
  () => {
    test(
      "keeps legacy Spanish business-message behavior intact",
      () => {
        const error = {
          status: 400,
          payload: {
            error: {
              message:
                "El ZIP no contiene archivos .cpp.",
            },
          },
        };

        expect(
          friendlyRequestError(
            error
          )
        ).toBe(
          "El ZIP no contiene archivos .cpp."
        );

        expect(
          localizedRequestError(
            error,
            tEs,
            {
              language: "es",
            }
          )
        ).toBe(
          "El ZIP no contiene archivos .cpp."
        );
      }
    );


    test(
      "does not expose an unknown Spanish business message in English",
      () => {
        const error = {
          status: 409,
          payload: {
            error: {
              message:
                "La solicitud ya fue resuelta.",
            },
          },
        };

        const message =
          localizedRequestError(
            error,
            tEn,
            {
              language: "en",
            }
          );

        expect(
          message
        ).toBe(
          "The request could not be completed. Try again."
        );

        expect(
          message
        ).not.toMatch(
          /solicitud|resuelta/i
        );
      }
    );


    test(
      "never exposes internal 500 detail and localizes reactively",
      () => {
        const error = {
          status: 500,
          payload: {
            error: {
              message:
                "psycopg2.OperationalError: connection refused",
            },
          },
        };

        const english =
          localizedRequestError(
            error,
            tEn,
            {
              language: "en",
            }
          );

        const spanish =
          localizedRequestError(
            error,
            tEs,
            {
              language: "es",
            }
          );

        expect(
          english
        ).toBe(
          "The service is temporarily unavailable. Try again in a few moments."
        );

        expect(
          spanish
        ).toBe(
          "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
        );

        expect(
          `${english} ${spanish}`
        ).not.toMatch(
          /psycopg2|connection refused/i
        );
      }
    );


    test(
      "supports stable code/status mappings and silent aborts",
      () => {
        expect(
          localizedRequestError(
            {
              status: 400,
              code:
                "ACCESS_ALREADY_RESOLVED",
            },
            tEn,
            {
              language: "en",
              codeKeys: {
                ACCESS_ALREADY_RESOLVED:
                  "commonErrors.conflict",
              },
            }
          )
        ).toBe(
          "The request has already been resolved."
        );

        expect(
          localizedRequestError(
            {
              status: 403,
            },
            tEn,
            {
              language: "en",
            }
          )
        ).toBe(
          "Your account does not have permission to perform this action."
        );

        expect(
          localizedRequestError(
            {
              name:
                "AbortError",
            },
            tEn,
            {
              language: "en",
            }
          )
        ).toBe("");
      }
    );
  }
);
