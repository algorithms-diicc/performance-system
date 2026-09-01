import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import TeacherProtocolsPanel
  from "./TeacherProtocolsPanel";
import {
  teacherApi,
} from "./teacherApi";


jest.mock(
  "./teacherApi",
  () => ({
    teacherApi: jest.fn(),
    teacherRequestErrorMessage:
      (_error, _t, options = {}) =>
        options.fallbackKey
        || "request error",
  })
);

jest.mock(
  "../i18n",
  () => ({
    useI18n: () => ({
      t: (key) => key,
    }),
  })
);


const POLICY_ROWS = [
  ["LCS", "QUICK", 100, 500, 750, 1000, 100, 960],
  ["LCS", "BALANCED", 100, 500, 500, 750, 100, 1680],
  ["LCS", "EXHAUSTIVE", 100, 500, 500, 500, 100, 1320],
  ["LCS", "CUSTOM", 100, 500, 500, 500, 100, 2640],
  ["CAMM", "QUICK", 1000, 5000, 100000, 130000, 1000, 360],
  ["CAMM", "BALANCED", 1000, 5000, 75000, 100000, 1000, 780],
  ["CAMM", "EXHAUSTIVE", 1000, 5000, 50000, 75000, 1000, 960],
  ["CAMM", "CUSTOM", 1000, 5000, 50000, 50000, 1000, 1380],
  ["SIZE", "QUICK", 100, 2500, 100000, 100000, 100, 120],
  ["SIZE", "BALANCED", 100, 2500, 100000, 100000, 100, 240],
  ["SIZE", "EXHAUSTIVE", 100, 2500, 100000, 100000, 100, 420],
  ["SIZE", "CUSTOM", 100, 2500, 100000, 100000, 100, 780],
];


const POLICY_PAYLOAD = {
  environment: {
    mode: "AUTO",
  },
  items: POLICY_ROWS.map(
    ([
      benchmark,
      executionProfile,
      minimumInput,
      defaultInput,
      recommendedMaxInput,
      hardMaxInput,
      inputStep,
      operationalTimeoutSeconds,
    ]) => ({
      benchmark,
      executionProfile,
      minimumInput,
      defaultInput,
      recommendedMaxInput,
      hardMaxInput,
      inputStep,
      operationalTimeoutSeconds,
    })
  ),
  total: 12,
};


function protocolRow(
  overrides = {}
) {
  return {
    id: 8,
    title: "LCS baseline",
    objective:
      "Compare implementations",
    benchmark: "LCS",
    inputSize: 500,
    samples: 10,
    dataType: null,
    executionProfile: "rapido",
    isPublished: false,
    isActive: true,
    state: "DRAFT",
    ...overrides,
  };
}


function arrangeApi({
  protocols = [],
  onProtocolRequest = null,
  policyError = null,
} = {}) {
  teacherApi.mockImplementation(
    (url, options = {}) => {
      if (
        url
        === "/api/measurement/policies"
      ) {
        if (policyError) {
          return Promise.reject(
            policyError
          );
        }
        return Promise.resolve(
          POLICY_PAYLOAD
        );
      }

      if (
        String(url).includes(
          "/protocols"
        )
        && typeof onProtocolRequest
          === "function"
      ) {
        const custom =
          onProtocolRequest(
            url,
            options
          );

        if (custom !== undefined) {
          return Promise.resolve(
            custom
          );
        }
      }

      if (
        String(url).match(
          /^\/api\/teacher\/courses\/\d+\/protocols$/
        )
        && !options.method
      ) {
        return Promise.resolve({
          items: protocols,
        });
      }

      return Promise.resolve({
        protocol: {
          id: 99,
        },
      });
    }
  );
}


describe(
  "TeacherProtocolsPanel",
  () => {
    beforeEach(() => {
      teacherApi.mockReset();
    });


    test(
      "loads protocols and the AUTO policy without exposing node selection",
      async () => {
        arrangeApi({
          protocols: [
            protocolRow(),
          ],
        });

        render(
          <TeacherProtocolsPanel
            courseId="4"
            courseActive
          />
        );

        expect(
          await screen.findByText(
            "LCS baseline"
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledWith(
          "/api/measurement/policies",
          expect.objectContaining({
            signal:
              expect.any(Object),
          })
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.publish",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /PINNED/i
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
      "creates an LCS QUICK draft using the operational default 500",
      async () => {
        arrangeApi({
          protocols: [],
        });

        render(
          <TeacherProtocolsPanel
            courseId="9"
            courseActive
          />
        );

        await waitFor(() => {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  "protocols.actions.create",
              }
            )
          ).toBeEnabled();
        });

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.create",
            }
          )
        );

        const titleLabel =
          screen.getByText(
            "protocols.fields.title"
          );
        const objectiveLabel =
          screen.getByText(
            "protocols.fields.objective"
          );
        const inputLabel =
          screen.getByText(
            "protocols.fields.inputSize"
          );

        expect(
          inputLabel.parentElement
            .querySelector("input")
        ).toHaveValue(500);

        expect(
          inputLabel.parentElement
            .querySelector("input")
        ).toHaveAttribute(
          "max",
          "1000"
        );

        fireEvent.change(
          titleLabel.parentElement
            .querySelector("input"),
          {
            target: {
              value:
                "Protocol LCS",
            },
          }
        );

        fireEvent.change(
          objectiveLabel.parentElement
            .querySelector("textarea"),
          {
            target: {
              value:
                "Measure scaling",
            },
          }
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.save",
            }
          )
        );

        await waitFor(() => {
          const postCall =
            teacherApi.mock.calls
              .find(
                ([url, options]) =>
                  url
                    === "/api/teacher/courses/9/protocols"
                  && options?.method
                    === "POST"
              );

          expect(
            postCall
          ).toBeTruthy();

          expect(
            JSON.parse(
              postCall[1].body
            )
          ).toEqual({
            title:
              "Protocol LCS",
            objective:
              "Measure scaling",
            instructions: "",
            benchmark: "LCS",
            inputSize: 500,
            executionProfile:
              "rapido",
            samples: 10,
            dataType: null,
          });
        });
      }
    );


    test(
      "changing benchmark adopts the selected policy default and limits",
      async () => {
        arrangeApi({
          protocols: [],
        });

        render(
          <TeacherProtocolsPanel
            courseId="9"
            courseActive
          />
        );

        await waitFor(() => {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  "protocols.actions.create",
              }
            )
          ).toBeEnabled();
        });

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.create",
            }
          )
        );

        const benchmark =
          screen.getByText(
            "protocols.fields.benchmark"
          ).parentElement
            .querySelector("select");

        fireEvent.change(
          benchmark,
          {
            target: {
              value: "CAMM",
            },
          }
        );

        const input =
          screen.getByText(
            "protocols.fields.inputSize"
          ).parentElement
            .querySelector("input");

        expect(input).toHaveValue(
          5000
        );
        expect(input).toHaveAttribute(
          "min",
          "1000"
        );
        expect(input).toHaveAttribute(
          "max",
          "130000"
        );
        expect(input).toHaveAttribute(
          "step",
          "1000"
        );
      }
    );


    test(
      "changing profile falls back to its default only when the current value exceeds hard max",
      async () => {
        arrangeApi({
          protocols: [],
        });

        render(
          <TeacherProtocolsPanel
            courseId="9"
            courseActive
          />
        );

        await waitFor(() => {
          expect(
            screen.getByRole(
              "button",
              {
                name:
                  "protocols.actions.create",
              }
            )
          ).toBeEnabled();
        });

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.create",
            }
          )
        );

        const input =
          screen.getByText(
            "protocols.fields.inputSize"
          ).parentElement
            .querySelector("input");

        fireEvent.change(
          input,
          {
            target: {
              value: "900",
            },
          }
        );

        const profile =
          screen.getByText(
            "protocols.fields.profile"
          ).parentElement
            .querySelector("select");

        fireEvent.change(
          profile,
          {
            target: {
              value:
                "exhaustivo",
            },
          }
        );

        expect(input).toHaveValue(
          500
        );
        expect(input).toHaveAttribute(
          "max",
          "500"
        );
      }
    );


    test(
      "policy unavailability blocks creation but keeps protocol review available",
      async () => {
        arrangeApi({
          protocols: [
            protocolRow(),
          ],
          policyError: {
            status: 503,
            code:
              "MEASUREMENT_POLICY_UNAVAILABLE",
          },
        });

        render(
          <TeacherProtocolsPanel
            courseId="4"
            courseActive
          />
        );

        expect(
          await screen.findByText(
            "LCS baseline"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.create",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getByRole(
            "alert"
          )
        ).toHaveTextContent(
          "protocols.teacher.errors.policy"
        );
      }
    );


    test(
      "inactive protocol can be republished when the course is active",
      async () => {
        arrangeApi({
          protocols: [
            protocolRow({
              id: 15,
              title:
                "Protocol inactive",
              benchmark: "SIZE",
              inputSize: 2500,
              isActive: false,
              state: "INACTIVE",
            }),
          ],
          onProtocolRequest:
            (url, options) => {
              if (
                url.endsWith(
                  "/15/publish"
                )
                && options.method
                  === "POST"
              ) {
                return {
                  protocol: {
                    id: 15,
                    isPublished: true,
                    isActive: true,
                  },
                };
              }

              return undefined;
            },
        });

        render(
          <TeacherProtocolsPanel
            courseId="6"
            courseActive
          />
        );

        expect(
          await screen.findByText(
            "Protocol inactive"
          )
        ).toBeInTheDocument();

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.publish",
            }
          )
        );

        await waitFor(() => {
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            "/api/teacher/courses/6/protocols/15/publish",
            {
              method: "POST",
            }
          );
        });
      }
    );


    test(
      "inactive course disables protocol creation",
      async () => {
        arrangeApi({
          protocols: [],
        });

        render(
          <TeacherProtocolsPanel
            courseId="5"
            courseActive={false}
          />
        );

        await screen.findByText(
          "protocols.teacher.emptyTitle"
        );

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "protocols.actions.create",
            }
          )
        ).toBeDisabled();
      }
    );
  }
);
