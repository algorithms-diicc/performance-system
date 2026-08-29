import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import OverviewModal from "./OverviewModal";

const baseProps = {
  visible: true,
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
  isSubmitting: false,
  testName: "LCS revisión",
  fileName: "lcs.zip",
  fileMeta: {
    sourceCount: 1,
    cCount: 0,
    cppCount: 1,
    sourceSample: ["main.cpp"],
  },
  taskTitle: "LCS",
  taskId: "lcs",
  inputSize: 500,
  inputLimits: {
    min: 100,
    max: 750,
    step: 100,
    recommendedMax: 500,
    defaultValue: 500,
    operationalTimeoutSeconds: 1680,
  },
  samples: 30,
  sampleLimits: {
    min: 1,
    max: 100,
  },
  dataTypeLabel: "",
  dataType: "",
  environmentLabel: "Pool multinodo de medición",
  measurementNodeMode: "AUTO",
  measurementNodeLabel: "",
  measurementHardwareProfileLabel: "",
  executionProfileLabel: "Equilibrado",
  executionProfileId: "equilibrado",
  courseLabel: "",
  hasCourse: false,
  username: "student@example.com",
};

describe("OverviewModal G13.2", () => {
  test("exposes modal dialog semantics and closes from Escape", () => {
    const onCancel = jest.fn();

    render(
      <OverviewModal
        {...baseProps}
        onCancel={onCancel}
      />
    );

    const dialog =
      screen.getByRole("dialog");

    expect(dialog).toHaveAttribute(
      "aria-modal",
      "true"
    );
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "rf-overview-title"
    );
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "rf-overview-description"
    );
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test("AUTO review shows the effective policy and no-ETA semantics", () => {
    render(<OverviewModal {...baseProps} />);

    expect(
      screen.getByText("AUTO · selección automática")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/se asignará automáticamente/i)
    ).toBeInTheDocument();

    const policyTitle = screen.getByText(
      "Política operacional efectiva"
    );

    expect(policyTitle).toBeInTheDocument();
    expect(
      policyTitle.closest(".rf-modal-policy-section")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Máximo recomendado")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Máximo absoluto")
    ).toBeInTheDocument();

    expect(
      screen.getByText("1680 s · 28 min")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no es una estimación del tiempo/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no garantiza que el benchmark finalice/i)
    ).toBeInTheDocument();
  });

  test("PINNED review identifies the registered node and profile", () => {
    render(
      <OverviewModal
        {...baseProps}
        measurementNodeMode="PINNED"
        environmentLabel="PINNED · Shenu · Shenu Intel i5-9400"
        measurementNodeLabel="Shenu"
        measurementHardwareProfileLabel="Shenu Intel i5-9400"
      />
    );

    expect(
      screen.getByText("PINNED · nodo fijado")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Shenu")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Perfil de hardware registrado")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Shenu Intel i5-9400")
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/hardware observado/i)
    ).not.toBeInTheDocument();
  });

  test("accepted input above recommended is labeled advanced", () => {
    render(
      <OverviewModal
        {...baseProps}
        inputSize={700}
      />
    );

    const note = screen.getByRole("note");

    expect(note).toHaveTextContent(
      /supera el máximo recomendado de 500/i
    );
    expect(note).toHaveTextContent(
      /dentro del máximo absoluto de 750/i
    );
  });
});
