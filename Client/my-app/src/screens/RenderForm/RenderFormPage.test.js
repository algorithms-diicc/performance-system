import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import JSZip from "jszip";

import RenderFormPage from "./RenderFormPage";

jest.mock("axios");
jest.mock("jszip", () => ({
  __esModule: true,
  default: { loadAsync: jest.fn() },
}));

jest.mock("./components/HeaderSection", () => () => null);
jest.mock("./components/AcademicCourseCard", () => {
  const ReactModule = require("react");
  return function MockAcademicCourseCard({
    selectedCourseId,
    onCourseChange,
  }) {
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "span",
        { "data-testid": "selected-course" },
        selectedCourseId || ""
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () => onCourseChange(""),
        },
        "Curso personal"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () => onCourseChange("12"),
        },
        "Curso 12"
      )
    );
  };
});
jest.mock("./components/MeasurementAndProfileSection", () => {
  const ReactModule = require("react");

  return function MockMeasurement({
    executionProfile,
    onExecutionProfileChange,
    measurementNodeMode,
    measurementNodes,
    selectedMeasurementNodeKey,
    onMeasurementNodeModeChange,
    onMeasurementNodeChange,
    measurementNodesLoading,
    measurementNodesError,
  }) {
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "span",
        {
          "data-testid":
            "execution-profile",
        },
        executionProfile || ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid":
            "measurement-node-mode",
        },
        measurementNodeMode || ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid":
            "measurement-node-key",
        },
        selectedMeasurementNodeKey ||
          ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid":
            "measurement-nodes-loading",
        },
        measurementNodesLoading
          ? "loading"
          : ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid":
            "measurement-nodes-error",
        },
        measurementNodesError
          ? "error"
          : ""
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onMeasurementNodeModeChange(
              "AUTO"
            ),
        },
        "Modo AUTO"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onMeasurementNodeModeChange(
              "PINNED"
            ),
        },
        "Modo PINNED"
      ),
      ...(Array.isArray(
        measurementNodes
      )
        ? measurementNodes.map(
            (node) =>
              ReactModule.createElement(
                "button",
                {
                  key: node.nodeKey,
                  type: "button",
                  onClick: () =>
                    onMeasurementNodeChange(
                      node.nodeKey
                    ),
                },
                `Nodo ${node.nodeKey}`
              )
          )
        : []),
      [
        "rapido",
        "equilibrado",
        "exhaustivo",
        "personalizado",
      ].map((profile) =>
        ReactModule.createElement(
          "button",
          {
            key: profile,
            type: "button",
            onClick: () =>
              onExecutionProfileChange(
                profile
              ),
          },
          `Perfil ${profile}`
        )
      )
    );
  };
});

jest.mock("./components/TestTypeAndParamsCard", () => {
  const ReactModule = require("react");
  return function MockTestTypeAndParamsCard({
    onTaskChange,
    selectedTaskType,
    inputSize,
    samples,
    dataType,
    onSamplesChange,
    onInputSizeChange,
    paramLimits,
  }) {
    const inputLimits =
      selectedTaskType
        ? paramLimits?.[selectedTaskType]?.inputSize
        : null;

    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () => onTaskChange("lcs"),
        },
        "Seleccionar benchmark"
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "selected-task-type" },
        selectedTaskType || ""
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "input-size" },
        String(inputSize ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "samples" },
        String(samples ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-min" },
        String(inputLimits?.min ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-default" },
        String(inputLimits?.defaultValue ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-recommended-max" },
        String(inputLimits?.recommendedMax ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-hard-max" },
        String(inputLimits?.max ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-step" },
        String(inputLimits?.step ?? "")
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "policy-timeout" },
        String(
          inputLimits?.operationalTimeoutSeconds ??
          ""
        )
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onInputSizeChange({
              target: { value: "1000" },
            }),
        },
        "Entrada 1000"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onSamplesChange({
              target: { value: "10" },
            }),
        },
        "Muestras 10"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onSamplesChange({
              target: { value: "30" },
            }),
        },
        "Muestras 30"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onSamplesChange({
              target: { value: "50" },
            }),
        },
        "Muestras 50"
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onSamplesChange({
              target: { value: "40" },
            }),
        },
        "Muestras 40"
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "data-type" },
        dataType || ""
      )
    );
  };
});

jest.mock("./components/StatusPanel", () => {
  const ReactModule = require("react");
  return function MockStatusPanel({
    isSubmitDisabled,
    onReset,
    fileList,
    isSubmitting,
    onPrepareNewAnalysis,
    submissionError,
    requirements,
  }) {
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "button",
        { type: "submit", disabled: isSubmitDisabled },
        "Revisar y ejecutar"
      ),
      ReactModule.createElement(
        "button",
        { type: "button", onClick: onReset },
        "Limpiar configuración"
      ),
      ReactModule.createElement(
        "span",
        { "data-testid": "requirements" },
        Array.isArray(requirements)
          ? requirements.join(",")
          : ""
      ),
      submissionError
        ? ReactModule.createElement(
            "div",
            { role: "alert" },
            submissionError
          )
        : null,
      isSubmitting &&
      Array.isArray(fileList) &&
      fileList.length > 0
        ? ReactModule.createElement(
            "button",
            {
              type: "button",
              onClick: onPrepareNewAnalysis,
            },
            "Preparar otro análisis"
          )
        : null
    );
  };
});

jest.mock("./components/OverviewModal", () => {
  const ReactModule = require("react");

  return function MockOverviewModal({
    visible,
    onConfirm,
    measurementNodeMode,
    measurementNodeLabel,
    measurementHardwareProfileLabel,
    inputLimits,
  }) {
    if (!visible) return null;

    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-measurement-mode",
        },
        measurementNodeMode || ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-node-label",
        },
        measurementNodeLabel || ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-hardware-profile",
        },
        measurementHardwareProfileLabel || ""
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-recommended-max",
        },
        String(inputLimits?.recommendedMax ?? "")
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-hard-max",
        },
        String(inputLimits?.max ?? "")
      ),
      ReactModule.createElement(
        "span",
        {
          "data-testid": "overview-timeout",
        },
        String(inputLimits?.operationalTimeoutSeconds ?? "")
      ),
      ReactModule.createElement(
        "button",
        {
          type: "button",
          onClick: onConfirm,
        },
        "Confirmar y ejecutar"
      )
    );
  };
});

jest.mock("./hooks/useExecutionPolling", () => () => ({
  messages: [],
  executionFiles: [],
  allDone: false,
  allTerminal: false,
  hasError: false,
  firstErrorMessage: "",
  requestError: "",
  retryPolling: jest.fn(),
}));

const DRAFT_KEY = "renderFormDraft_v2";
const currentUser = {
  id: 7,
  email: "student@inf.udec.cl",
  role_name: "Student",
};

const courseResponse = {
  data: {
    items: [],
    selectionRequired: false,
    autoSelectedCourseId: null,
    personalAllowed: true,
  },
};


const measurementNodeResponse = {
  data: {
    defaultMode: "AUTO",
    total: 1,
    items: [
      {
        nodeKey: "shenu",
        displayName: "Shenu",
        state: "AVAILABLE",
        validationOnly: false,
        hardwareProfile: {
          profileKey:
            "shenu-intel-i5-9400",
          name:
            "Shenu Intel i5-9400",
        },
      },
    ],
  },
};


const measurementPolicyItem = (
  benchmark,
  executionProfile,
  {
    minimumInput,
    defaultInput,
    recommendedMaxInput,
    hardMaxInput,
    inputStep,
    operationalTimeoutSeconds,
  }
) => ({
  benchmark,
  executionProfile,
  minimumInput,
  defaultInput,
  recommendedMaxInput,
  hardMaxInput,
  inputStep,
  operationalTimeoutSeconds,
});

const measurementPolicyResponse = {
  data: {
    environment: { mode: "AUTO" },
    availability: { available: true },
    total: 12,
    items: [
      measurementPolicyItem("LCS", "QUICK", {
        minimumInput: 100,
        defaultInput: 500,
        recommendedMaxInput: 750,
        hardMaxInput: 1000,
        inputStep: 100,
        operationalTimeoutSeconds: 960,
      }),
      measurementPolicyItem("LCS", "BALANCED", {
        minimumInput: 100,
        defaultInput: 500,
        recommendedMaxInput: 500,
        hardMaxInput: 750,
        inputStep: 100,
        operationalTimeoutSeconds: 1680,
      }),
      measurementPolicyItem("LCS", "EXHAUSTIVE", {
        minimumInput: 100,
        defaultInput: 500,
        recommendedMaxInput: 500,
        hardMaxInput: 500,
        inputStep: 100,
        operationalTimeoutSeconds: 1320,
      }),
      measurementPolicyItem("LCS", "CUSTOM", {
        minimumInput: 100,
        defaultInput: 500,
        recommendedMaxInput: 500,
        hardMaxInput: 500,
        inputStep: 100,
        operationalTimeoutSeconds: 2640,
      }),

      measurementPolicyItem("CAMM", "QUICK", {
        minimumInput: 1000,
        defaultInput: 5000,
        recommendedMaxInput: 100000,
        hardMaxInput: 130000,
        inputStep: 1000,
        operationalTimeoutSeconds: 360,
      }),
      measurementPolicyItem("CAMM", "BALANCED", {
        minimumInput: 1000,
        defaultInput: 5000,
        recommendedMaxInput: 75000,
        hardMaxInput: 100000,
        inputStep: 1000,
        operationalTimeoutSeconds: 780,
      }),
      measurementPolicyItem("CAMM", "EXHAUSTIVE", {
        minimumInput: 1000,
        defaultInput: 5000,
        recommendedMaxInput: 50000,
        hardMaxInput: 75000,
        inputStep: 1000,
        operationalTimeoutSeconds: 960,
      }),
      measurementPolicyItem("CAMM", "CUSTOM", {
        minimumInput: 1000,
        defaultInput: 5000,
        recommendedMaxInput: 50000,
        hardMaxInput: 50000,
        inputStep: 1000,
        operationalTimeoutSeconds: 1380,
      }),

      measurementPolicyItem("SIZE", "QUICK", {
        minimumInput: 100,
        defaultInput: 2500,
        recommendedMaxInput: 100000,
        hardMaxInput: 100000,
        inputStep: 100,
        operationalTimeoutSeconds: 120,
      }),
      measurementPolicyItem("SIZE", "BALANCED", {
        minimumInput: 100,
        defaultInput: 2500,
        recommendedMaxInput: 100000,
        hardMaxInput: 100000,
        inputStep: 100,
        operationalTimeoutSeconds: 240,
      }),
      measurementPolicyItem("SIZE", "EXHAUSTIVE", {
        minimumInput: 100,
        defaultInput: 2500,
        recommendedMaxInput: 100000,
        hardMaxInput: 100000,
        inputStep: 100,
        operationalTimeoutSeconds: 420,
      }),
      measurementPolicyItem("SIZE", "CUSTOM", {
        minimumInput: 100,
        defaultInput: 2500,
        recommendedMaxInput: 100000,
        hardMaxInput: 100000,
        inputStep: 100,
        operationalTimeoutSeconds: 780,
      }),
    ],
  },
};


const pinnedMeasurementPolicyResponse = {
  data: {
    ...measurementPolicyResponse.data,
    environment: {
      mode: "PINNED",
      node:
        measurementNodeResponse
          .data.items[0],
    },
    items:
      measurementPolicyResponse
        .data.items.map((item) => {
          if (
            item.benchmark === "LCS" &&
            item.executionProfile ===
              "BALANCED"
          ) {
            return {
              ...item,
              minimumInput: 100,
              defaultInput: 400,
              recommendedMaxInput: 450,
              hardMaxInput: 600,
              inputStep: 100,
              operationalTimeoutSeconds:
                900,
            };
          }

          return item;
        }),
  },
};

const makeZip = (filename) => {
  const file = new File(["zip-content"], filename, {
    type: "application/zip",
  });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  });
  return file;
};

const renderPage = async (route = "/new-analysis") => {
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <RenderFormPage currentUser={currentUser} />
    </MemoryRouter>
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const selectZipFromInput = async (filename) => {
  const file = makeZip(filename);
  const input = screen.getByLabelText(/Archivo de código/);

  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  await screen.findByText(filename, { selector: ".file-meta-name" });
  return file;
};

const dropZip = async (filename) => {
  const file = makeZip(filename);
  const dropzone = screen.getByRole("button", {
    name: "Seleccionar archivo de código ZIP",
  });

  await act(async () => {
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });
  });

  await screen.findByText(filename, { selector: ".file-meta-name" });
  return file;
};

const selectBenchmark = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Seleccionar benchmark" })
  );
};

const submitThroughOverview = async () => {
  const review = screen.getByRole("button", {
    name: "Revisar y ejecutar",
  });
  await waitFor(() => expect(review).toBeEnabled());
  fireEvent.click(review);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Confirmar y ejecutar",
    })
  );
  await waitFor(() => expect(axios).toHaveBeenCalledTimes(1));
  return axios.mock.calls[0][0].data;
};

describe("RenderFormPage 6A onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.alert = jest.fn();
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      value: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    axios.get.mockImplementation((url) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (
        String(url).includes(
          "api/analysis/courses"
        )
      ) {
        return Promise.resolve(courseResponse);
      }

      return Promise.reject(
        new Error(`Unexpected GET ${url}`)
      );
    });
    axios.mockReturnValue(new Promise(() => {}));
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("src/main.cpp", { dir: false });
      },
    });
  });


  test("optional academic context honors a valid course query even with one course", async () => {
    const optionalCourseResponse = {
      data: {
        items: [
          {
            id: 12,
            code: "INF-221",
            name: "Algoritmos",
            academicYear: 2026,
            academicTerm: 2,
            teacher: {
              fullName: "Ada Teacher",
            },
          },
        ],
        selectionRequired: false,
        autoSelectedCourseId: null,
        personalAllowed: true,
      },
    };

    axios.get.mockImplementation((url) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (
        String(url).includes(
          "api/analysis/courses"
        )
      ) {
        return Promise.resolve(
          optionalCourseResponse
        );
      }

      return Promise.reject(
        new Error(`Unexpected GET ${url}`)
      );
    });

    await renderPage(
      "/new-analysis?course=12"
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("selected-course")
      ).toHaveTextContent("12");
    });
  });

  test(
    "one Student course remains the default but can be changed to personal",
    async () => {
      const oneCourseResponse = {
        data: {
          items: [
            {
              id: 12,
              code: "INF-221",
              name: "Algoritmos",
              academicYear: 2026,
              academicTerm: 2,
            },
          ],
          selectionRequired: false,
          autoSelectedCourseId: 12,
          personalAllowed: true,
        },
      };

      axios.get.mockImplementation((url) => {
        if (
          String(url).includes(
            "api/measurement/policies"
          )
        ) {
          return Promise.resolve(
            measurementPolicyResponse
          );
        }

        if (
          String(url).includes(
            "api/analysis/courses"
          )
        ) {
          return Promise.resolve(
            oneCourseResponse
          );
        }

        return Promise.reject(
          new Error(`Unexpected GET ${url}`)
        );
      });

      await renderPage();

      await waitFor(() => {
        expect(
          screen.getByTestId("selected-course")
        ).toHaveTextContent("12");
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Curso personal",
        })
      );

      expect(
        screen.getByTestId("selected-course")
      ).toHaveTextContent("");
    }
  );

  test(
    "AUTO remains default and does not discover nodes eagerly",
    async () => {
      await renderPage();

      expect(
        screen.getByTestId(
          "measurement-node-mode"
        )
      ).toHaveTextContent(
        "AUTO"
      );

      expect(
        axios.get.mock.calls.some(
          ([url]) =>
            String(url).includes(
              "api/measurement/nodes"
            )
        )
      ).toBe(false);
    }
  );

  test(
    "AUTO blocks review when no live measurement node is reported",
    async () => {
      const unavailablePolicyResponse = {
        data: {
          ...measurementPolicyResponse.data,
          availability: { available: false },
        },
      };

      axios.get.mockImplementation((url) => {
        if (
          String(url).includes(
            "api/measurement/policies"
          )
        ) {
          return Promise.resolve(
            unavailablePolicyResponse
          );
        }

        if (
          String(url).includes(
            "api/analysis/courses"
          )
        ) {
          return Promise.resolve(
            courseResponse
          );
        }

        return Promise.reject(
          new Error(`Unexpected GET ${url}`)
        );
      });

      await renderPage();

      await waitFor(() => {
        expect(
          screen.getByTestId("requirements")
        ).toHaveTextContent(
          "measurementUnavailable"
        );
      });

      expect(
        screen.getByRole("button", {
          name: "Revisar y ejecutar",
        })
      ).toBeDisabled();
    }
  );

  test(
    "pre-submit review receives AUTO mode and effective policy",
    async () => {
      await renderPage();

      selectBenchmark();
      await selectZipFromInput(
        "review-auto.zip"
      );

      const review =
        screen.getByRole(
          "button",
          {
            name:
              "Revisar y ejecutar",
          }
        );

      await waitFor(() =>
        expect(
          review
        ).toBeEnabled()
      );

      fireEvent.click(review);

      expect(
        screen.getByTestId(
          "overview-measurement-mode"
        )
      ).toHaveTextContent(
        "AUTO"
      );

      expect(
        screen.getByTestId(
          "overview-recommended-max"
        )
      ).toHaveTextContent(
        "500"
      );

      expect(
        screen.getByTestId(
          "overview-hard-max"
        )
      ).toHaveTextContent(
        "750"
      );

      expect(
        screen.getByTestId(
          "overview-timeout"
        )
      ).toHaveTextContent(
        "1680"
      );
    }
  );

  test(
    "AUTO submit sends explicit mode without a node key",
    async () => {
      axios.mockResolvedValue({
        data: {
          submissionId: 81,
          executions: [
            {
              publicId:
                "00000000-0000-0000-0000-000000000081",
              codename:
                "autoLCS",
            },
          ],
        },
      });

      await renderPage();
      selectBenchmark();
      await selectZipFromInput(
        "auto.zip"
      );

      const form =
        await submitThroughOverview();

      expect(
        form.get(
          "measurement_node_mode"
        )
      ).toBe("AUTO");

      expect(
        form.get(
          "measurement_node_key"
        )
      ).toBeNull();
    }
  );

  test(
    "a backend availability race is surfaced as a specific temporary error",
    async () => {
      axios.mockRejectedValue({
        response: {
          status: 503,
          data: {
            error: {
              code: "MEASUREMENT_UNAVAILABLE",
            },
          },
        },
      });

      await renderPage();
      selectBenchmark();
      await selectZipFromInput(
        "availability-race.zip"
      );

      const review =
        screen.getByRole("button", {
          name: "Revisar y ejecutar",
        });

      await waitFor(() =>
        expect(review).toBeEnabled()
      );

      fireEvent.click(review);
      fireEvent.click(
        await screen.findByRole(
          "button",
          {
            name: "Confirmar y ejecutar",
          }
        )
      );

      expect(
        await screen.findByRole("alert")
      ).toHaveTextContent(
        /entorno de medición no está disponible/i
      );
    }
  );

  test(
    "personal submission sends an explicit PERSONAL course mode",
    async () => {
      axios.mockResolvedValue({
        data: {
          submissionId: 83,
          executions: [
            {
              publicId:
                "00000000-0000-0000-0000-000000000083",
              codename: "personalLCS",
            },
          ],
        },
      });

      await renderPage();
      selectBenchmark();
      await selectZipFromInput(
        "personal.zip"
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Curso personal",
        })
      );

      const form =
        await submitThroughOverview();

      expect(
        form.get("course_id")
      ).toBeNull();
      expect(
        form.get("course_mode")
      ).toBe("PERSONAL");
    }
  );

  test(
    "PINNED discovers nodes lazily, reloads policy and submits only nodeKey",
    async () => {
      axios.get.mockImplementation(
        (url) => {
          const value =
            String(url);

          if (
            value.includes(
              "api/measurement/policies"
            ) &&
            value.includes(
              "nodeKey=shenu"
            )
          ) {
            return Promise.resolve(
              pinnedMeasurementPolicyResponse
            );
          }

          if (
            value.includes(
              "api/measurement/policies"
            )
          ) {
            return Promise.resolve(
              measurementPolicyResponse
            );
          }

          if (
            value.includes(
              "api/measurement/nodes"
            )
          ) {
            return Promise.resolve(
              measurementNodeResponse
            );
          }

          if (
            value.includes(
              "api/analysis/courses"
            )
          ) {
            return Promise.resolve(
              courseResponse
            );
          }

          return Promise.reject(
            new Error(
              `Unexpected GET ${url}`
            )
          );
        }
      );

      axios.mockResolvedValue({
        data: {
          submissionId: 82,
          executions: [
            {
              publicId:
                "00000000-0000-0000-0000-000000000082",
              codename:
                "pinnedLCS",
            },
          ],
        },
      });

      await renderPage();

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name:
              "Modo PINNED",
          }
        )
      );

      await waitFor(() => {
        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Nodo shenu",
            }
          )
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name:
              "Nodo shenu",
          }
        )
      );

      await waitFor(() => {
        expect(
          screen.getByTestId(
            "measurement-node-key"
          )
        ).toHaveTextContent(
          "shenu"
        );
      });

      selectBenchmark();

      await waitFor(() => {
        expect(
          screen.getByTestId(
            "policy-default"
          )
        ).toHaveTextContent(
          "400"
        );
      });

      expect(
        screen.getByTestId(
          "policy-hard-max"
        )
      ).toHaveTextContent(
        "600"
      );

      await selectZipFromInput(
        "pinned.zip"
      );

      const form =
        await submitThroughOverview();

      expect(
        form.get(
          "measurement_node_mode"
        )
      ).toBe("PINNED");

      expect(
        form.get(
          "measurement_node_key"
        )
      ).toBe("shenu");

      expect(
        Array.from(
          form.keys()
        )
      ).not.toContain(
        "measurement_node_id"
      );
    }
  );

  test("uses Lucide icons for structural upload affordances", async () => {
    const { container } = await renderPage();

    expect(
      container.querySelector(".label-icon .lucide-tag")
    ).toBeInTheDocument();
    expect(
      container.querySelector(".label-icon .lucide-sticky-note")
    ).toBeInTheDocument();
    expect(
      container.querySelector(".label-icon .lucide-folder-archive")
    ).toBeInTheDocument();
    expect(
      container.querySelector(".file-upload-icon .lucide-upload")
    ).toBeInTheDocument();
  });

  test("file input suggests a title while preserving the real filename", async () => {
    await renderPage();
    await selectZipFromInput("mi.algoritmo.v2.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "mi.algoritmo.v2"
    );
    expect(
      screen.getByText("mi.algoritmo.v2.zip", {
        selector: ".file-meta-name",
      })
    ).toBeInTheDocument();
  });

  test("drag and drop uses the same title suggestion behavior", async () => {
    await renderPage();
    await dropZip("ARRASTRADO.ZIP");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "ARRASTRADO"
    );
  });

  test("a manual title set before the ZIP is not overwritten", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Nombre del test"), {
      target: { value: "Título manual" },
    });

    await selectZipFromInput("archivo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Título manual"
    );
  });

  test("an untouched suggestion follows a replacement ZIP", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    await selectZipFromInput("segundo.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "segundo"
    );
  });

  test("editing an automatic title protects it from replacement ZIPs", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    fireEvent.change(screen.getByLabelText("Nombre del test"), {
      target: { value: "Título ajustado" },
    });
    await selectZipFromInput("segundo.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Título ajustado"
    );
  });

  test("clearing the title stays empty until another ZIP is selected", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    const title = screen.getByLabelText("Nombre del test");

    fireEvent.change(title, { target: { value: "" } });
    expect(title).toHaveValue("");

    await selectZipFromInput("reemplazo.zip");
    expect(title).toHaveValue("reemplazo");
  });

  test("draft title and note load retrocompatibly as manual data", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador recuperado",
        note: "Recordar comparar con la versión base",
      })
    );

    await renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre del test")).toHaveValue(
        "Borrador recuperado"
      )
    );
    expect(screen.getByLabelText(/Nota personal/)).toHaveValue(
      "Recordar comparar con la versión base"
    );
    expect(
      screen.getByText("Se restauró tu configuración anterior.")
    ).toBeInTheDocument();

    await selectZipFromInput("nuevo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Borrador recuperado"
    );
  });

  test("default autosave does not show a false restored-draft notice", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "",
        note: "",
        selectedTaskType: "",
        inputSize: 1000,
        samples: 30,
        dataType: "",
        executionProfile: "equilibrado",
      })
    );

    await renderPage();

    expect(
      screen.queryByText("Se restauró tu configuración anterior.")
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });

  test("clear draft restores coherent defaults and removes persistence", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador",
        note: "Nota",
        selectedTaskType: "lcs",
        inputSize: 750,
        samples: 40,
        dataType: "",
        executionProfile: "personalizado",
      })
    );

    await renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Limpiar borrador" })
    );

    expect(screen.getByLabelText("Nombre del test")).toHaveValue("");
    expect(screen.getByLabelText(/Nota personal/)).toHaveValue("");
    expect(screen.getByTestId("selected-task-type")).toHaveTextContent("");
    expect(screen.getByTestId("execution-profile")).toHaveTextContent(
      "equilibrado"
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    });
  });

  test("an old draft without note loads the empty optional field", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 1, testName: "Borrador antiguo" })
    );

    await renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/Nota personal/)).toHaveValue("")
    );
  });

  test("a title recovered from an execution remains manual", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador que no debe ganar",
      })
    );

    axios.get.mockImplementation((url) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (url.includes("api/analysis/courses")) {
        return Promise.resolve(courseResponse);
      }
      return Promise.resolve({
        data: {
          execution: {
            publicId: "uuid-1",
            codename: "recoverLCS",
            originalFilename: "original.cpp",
            submissionTitle: "Ejecución recuperada",
            benchmark: "LCS",
            inputSize: 500,
            samples: 30,
            terminal: true,
          },
        },
      });
    });

    await renderPage("/new-analysis?execution=uuid-1");
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre del test")).toHaveValue(
        "Ejecución recuperada"
      )
    );
    expect(
      screen.queryByText("Se restauró tu configuración anterior.")
    ).not.toBeInTheDocument();

    await selectZipFromInput("reemplazo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Ejecución recuperada"
    );
  });

  test("reuse preloads configuration without copying historical content", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador que no debe contaminar reuse",
        selectedTaskType: "size",
        inputSize: 2500,
        samples: 50,
        executionProfile: "exhaustivo",
      })
    );

    axios.get.mockImplementation((url) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (url.includes("api/analysis/courses")) {
        return Promise.resolve({
          data: {
            items: [
              { id: 12, code: "CC4102" },
              { id: 13, code: "CC4201" },
            ],
            selectionRequired: true,
          },
        });
      }

      if (url.includes("/reuse")) {
        return Promise.resolve({
          data: {
            reuse: {
              sourcePublicId: "reuse-1",
              benchmark: "CAMMR",
              inputSize: 5000,
              samples: 30,
              executionProfile: "BALANCED",
              courseId: 12,
            },
          },
        });
      }

      return Promise.reject(
        new Error(`Unexpected GET ${url}`)
      );
    });

    await renderPage(
      "/new-analysis?reuse=reuse-1&course=13"
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("selected-task-type")
      ).toHaveTextContent("camm");
    });

    expect(
      screen.getByTestId("data-type")
    ).toHaveTextContent("cammr");
    expect(
      screen.getByTestId("input-size")
    ).toHaveTextContent("5000");
    expect(
      screen.getByTestId("samples")
    ).toHaveTextContent("30");
    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("equilibrado");
    expect(
      screen.getByTestId("selected-course")
    ).toHaveTextContent("12");

    // reuse > course, y no se copia contenido histórico.
    expect(
      screen.getByLabelText("Nombre del test")
    ).toHaveValue("");
    expect(
      screen.getByLabelText(/Nota personal/)
    ).toHaveValue("");
    expect(
      screen.getByRole("button", {
        name: "Revisar y ejecutar",
      })
    ).toBeDisabled();
    expect(
      screen.queryByText("Se restauró tu configuración anterior.")
    ).not.toBeInTheDocument();
  });

  test("repeat downloads and validates the historical ZIP, preloads values, and never auto-submits", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador que Repeat debe omitir",
        note: "No copiar",
        selectedTaskType: "lcs",
      })
    );

    axios.get.mockImplementation((url, options) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (url.includes("api/analysis/courses")) {
        return Promise.resolve({
          data: {
            items: [{ id: 12, code: "CC4102" }],
            selectionRequired: false,
          },
        });
      }
      if (url.includes("/submissions/42/repeat")) {
        return Promise.resolve({
          data: {
            repeat: {
              sourceSubmissionId: 42,
              archiveFilename: "sorting.zip",
              archiveUrl: "/api/submissions/42/archive",
              benchmark: "CAMMR",
              inputSize: 5000,
              samples: 30,
              executionProfile: "BALANCED",
              courseId: 12,
            },
          },
        });
      }
      if (url.includes("/submissions/42/archive")) {
        expect(options).toMatchObject({
          withCredentials: true,
          responseType: "blob",
        });
        return Promise.resolve({
          data: new Blob(["zip-content"], {
            type: "application/zip",
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await renderPage(
      "/new-analysis?repeat=42&reuse=must-not-win&course=99"
    );

    expect(
      await screen.findByText(
        "Experimento #42 cargado para repetición. Revisa la configuración antes de ejecutar."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("selected-task-type")).toHaveTextContent(
      "camm"
    );
    expect(screen.getByTestId("data-type")).toHaveTextContent("cammr");
    expect(screen.getByTestId("input-size")).toHaveTextContent("5000");
    expect(screen.getByTestId("samples")).toHaveTextContent("30");
    expect(screen.getByTestId("execution-profile")).toHaveTextContent(
      "equilibrado"
    );
    expect(screen.getByTestId("selected-course")).toHaveTextContent("12");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue("sorting");
    expect(screen.getByLabelText(/Nota personal/)).toHaveValue("");
    expect(screen.getByText("sorting.zip", { selector: ".file-meta-name" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revisar y ejecutar" })
    ).toBeEnabled();
    expect(
      axios.get.mock.calls.some(([url]) => String(url).includes("/reuse"))
    ).toBe(false);
    expect(axios).not.toHaveBeenCalled();
    expect(JSZip.loadAsync).toHaveBeenCalledTimes(1);
  });

  test("repeat configuration inconsistency stays review-only and localized", async () => {
    axios.get.mockImplementation((url) => {
      if (
        String(url).includes(
          "api/measurement/policies"
        )
      ) {
        return Promise.resolve(
          measurementPolicyResponse
        );
      }

      if (url.includes("api/analysis/courses")) {
        return Promise.resolve(courseResponse);
      }
      if (url.includes("/submissions/42/repeat")) {
        return Promise.reject({ response: { status: 409 } });
      }
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    await renderPage("/new-analysis?repeat=42");

    expect(
      await screen.findByText(/no comparten una configuración común/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revisar y ejecutar" })
    ).toBeDisabled();
    expect(axios).not.toHaveBeenCalled();
  });

  test("note is secondary, editable, counted and limited to 500", async () => {
    await renderPage();
    const title = screen.getByLabelText("Nombre del test");
    const note = screen.getByLabelText(/Nota personal/);

    expect(title).toHaveAttribute("maxLength", "255");
    expect(note).toHaveAttribute("maxLength", "500");
    expect(screen.getByText("Solo tú podrás ver esta nota.")).toBeInTheDocument();
    expect(screen.getByText("0 / 500 caracteres")).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "Título independiente" } });
    fireEvent.change(note, { target: { value: "nota" } });

    expect(title).toHaveValue("Título independiente");
    expect(note).toHaveValue("nota");
    expect(screen.getByText("4 / 500 caracteres")).toBeInTheDocument();
  });

  test("draft autosave includes note and reset clears it", async () => {
    await renderPage();
    const note = screen.getByLabelText(/Nota personal/);
    fireEvent.change(note, { target: { value: "Nota del borrador" } });

    await waitFor(() => {
      const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
      expect(draft.note).toBe("Nota del borrador");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Limpiar configuración" })
    );
    expect(note).toHaveValue("");
    expect(
      screen.getByTestId("selected-task-type")
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("input-size")
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("policy-min")
    ).toHaveTextContent("");
    expect(
      screen.getByTestId("policy-default")
    ).toHaveTextContent("");

    await waitFor(() => {
      expect(
        window.localStorage.getItem(DRAFT_KEY)
      ).toBeNull();
    });

    selectBenchmark();

    await waitFor(() => {
      expect(
        screen.getByTestId("input-size")
      ).toHaveTextContent("500");
    });
  });

  test("predefined profiles synchronize 10/30/50 and Custom keeps manual samples", async () => {
    await renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Perfil rapido" })
    );
    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("rapido");
    expect(screen.getByTestId("samples")).toHaveTextContent("10");

    fireEvent.click(
      screen.getByRole("button", { name: "Perfil equilibrado" })
    );
    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("equilibrado");
    expect(screen.getByTestId("samples")).toHaveTextContent("30");

    fireEvent.click(
      screen.getByRole("button", { name: "Perfil exhaustivo" })
    );
    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("exhaustivo");
    expect(screen.getByTestId("samples")).toHaveTextContent("50");

    fireEvent.click(
      screen.getByRole("button", { name: "Perfil personalizado" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Muestras 40" })
    );
    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("personalizado");
    expect(screen.getByTestId("samples")).toHaveTextContent("40");
  });

  test(
    "measurement policies drive the LCS QUICK contract",
    async () => {
      await renderPage();

      await waitFor(() => {
        expect(
          axios.get.mock.calls.some(
            ([url]) =>
              String(url).includes(
                "api/measurement/policies"
              )
          )
        ).toBe(true);
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Perfil rapido",
        })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("samples")
        ).toHaveTextContent("10");
      });

      selectBenchmark();

      await waitFor(() => {
        expect(
          screen.getByTestId("input-size")
        ).toHaveTextContent("500");
      });

      expect(
        screen.getByTestId("policy-min")
      ).toHaveTextContent("100");

      expect(
        screen.getByTestId("policy-default")
      ).toHaveTextContent("500");

      expect(
        screen.getByTestId(
          "policy-recommended-max"
        )
      ).toHaveTextContent("750");

      expect(
        screen.getByTestId("policy-hard-max")
      ).toHaveTextContent("1000");

      expect(
        screen.getByTestId("policy-step")
      ).toHaveTextContent("100");

      expect(
        screen.getByTestId("policy-timeout")
      ).toHaveTextContent("960");
    }
  );

  test(
    "changing LCS from QUICK to BALANCED applies the new effective contract",
    async () => {
      await renderPage();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Perfil rapido",
        })
      );

      selectBenchmark();

      await waitFor(() => {
        expect(
          screen.getByTestId("policy-hard-max")
        ).toHaveTextContent("1000");
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: "Entrada 1000",
        })
      );

      expect(
        screen.getByTestId("input-size")
      ).toHaveTextContent("1000");

      fireEvent.click(
        screen.getByRole("button", {
          name: "Perfil equilibrado",
        })
      );

      await waitFor(() => {
        expect(
          screen.getByTestId("samples")
        ).toHaveTextContent("30");
      });

      // 1000 deja de ser válido porque BALANCED tiene
      // hardMax 750; la página vuelve al default 500.
      expect(
        screen.getByTestId("input-size")
      ).toHaveTextContent("500");

      expect(
        screen.getByTestId(
          "policy-recommended-max"
        )
      ).toHaveTextContent("500");

      expect(
        screen.getByTestId("policy-hard-max")
      ).toHaveTextContent("750");

      expect(
        screen.getByTestId("policy-timeout")
      ).toHaveTextContent("1680");
    }
  );

  test(
    "measurement policy API failure keeps the form fail-closed",
    async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      axios.get.mockImplementation((url) => {
        if (
          String(url).includes(
            "api/measurement/policies"
          )
        ) {
          return Promise.reject(
            new Error("policy unavailable")
          );
        }

        if (
          String(url).includes(
            "api/analysis/courses"
          )
        ) {
          return Promise.resolve(
            courseResponse
          );
        }

        return Promise.reject(
          new Error(`Unexpected GET ${url}`)
        );
      });

      try {
        await renderPage();

        await waitFor(() => {
          expect(
            screen.getByTestId("requirements")
          ).toHaveTextContent(
            "measurementPolicyUnavailable"
          );
        });

        expect(
          screen.getByRole("button", {
            name: "Revisar y ejecutar",
          })
        ).toBeDisabled();
      } finally {
        consoleSpy.mockRestore();
      }
    }
  );


  test("an accepted submission clears the saved draft", async () => {
    await renderPage();
    await selectZipFromInput("cola.zip");
    selectBenchmark();

    fireEvent.change(screen.getByLabelText(/Nota personal/), {
      target: { value: "Borrador que ya fue enviado" },
    });

    await waitFor(() => {
      expect(
        window.localStorage.getItem(DRAFT_KEY)
      ).not.toBeNull();
    });

    axios.mockResolvedValueOnce({
      data: {
        submissionId: 143,
        executions: [
          {
            publicId: "execution-143",
            codename: "queue143LCS",
          },
        ],
      },
    });

    await submitThroughOverview();

    await waitFor(() => {
      expect(
        window.localStorage.getItem(DRAFT_KEY)
      ).toBeNull();
    });
  });

  test("a running execution can be detached without sending a cancellation request", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    selectBenchmark();

    axios.mockResolvedValueOnce({
      data: {
        submissionId: 144,
        executions: [
          {
            publicId: "execution-144",
            codename: "queue144LCS",
          },
        ],
      },
    });

    await submitThroughOverview();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Preparar otro análisis",
      })
    );

    // POST /sendcode fue la única solicitud mutante: liberar la vista
    // no cancela ni altera la ejecución persistida.
    expect(axios).toHaveBeenCalledTimes(1);

    expect(
      screen.getByTestId("selected-task-type")
    ).toHaveTextContent("");
    expect(
      screen.getByRole("button", {
        name: "Revisar y ejecutar",
      })
    ).toBeDisabled();
  });

  test("FormData sends trimmed title and non-empty note atomically", async () => {
    await renderPage();
    await selectZipFromInput("algoritmos.zip");
    selectBenchmark();
    fireEvent.change(screen.getByLabelText(/Nota personal/), {
      target: { value: "  Nota privada  " },
    });

    const formData = await submitThroughOverview();
    expect(formData.get("title")).toBe("algoritmos");
    expect(formData.get("note")).toBe("Nota privada");
    expect(formData.get("file").name).toBe("algoritmos.zip");
  });

  test("empty note does not block submit and is omitted from FormData", async () => {
    await renderPage();
    await selectZipFromInput(".zip");
    selectBenchmark();

    const formData = await submitThroughOverview();
    expect(formData.get("title")).toBe("Entrada de texto");
    expect(formData.get("note")).toBeNull();
    expect(formData.get("file").name).toBe(".zip");
  });

  test("LCS starter uses the recommended Quick input", async () => {
    await renderPage("/new-analysis?starter=lcs");

    await waitFor(() => {
      expect(
        screen.getByTestId("selected-task-type")
      ).toHaveTextContent("lcs");
    });

    expect(
      screen.getByTestId("execution-profile")
    ).toHaveTextContent("rapido");
    expect(
      screen.getByTestId("samples")
    ).toHaveTextContent("10");
    expect(
      screen.getByTestId("input-size")
    ).toHaveTextContent("500");
    expect(
      screen.getByTestId("policy-recommended-max")
    ).toHaveTextContent("750");
    expect(
      screen.getByTestId("policy-hard-max")
    ).toHaveTextContent("1000");

    const inputSize = Number(
      screen.getByTestId("input-size").textContent
    );
    const recommendedMax = Number(
      screen.getByTestId("policy-recommended-max").textContent
    );

    expect(inputSize).toBeLessThanOrEqual(recommendedMax);
    expect(
      screen.getByText(
        /Configuración inicial preparada para LCS/i
      )
    ).toBeInTheDocument();
  });

});
