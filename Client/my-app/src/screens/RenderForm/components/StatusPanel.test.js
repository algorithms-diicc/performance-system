import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";

import StatusPanel from "./StatusPanel";

const summary = {
  fileName: "implementaciones.zip",
  taskTitle: "Entrada de texto",
  inputSizeLabel: "500",
  samplesLabel: "30 por punto",
  profileLabel: "Equilibrado",
  environmentLabel: "Pool multinodo de medición",
};

const executionFiles = [
  {
    publicId:
      "00000000-0000-0000-0000-000000000101",
    codename: "longfilenameLCS",
    originalName:
      "implementacion_con_nombre_muy_largo.cpp",
    state: "RUNNING",
    resultsReady: false,
    terminal: false,
    canCancel: false,
    measurementNode: {
      nodeKey: "shenu",
      displayName: "Shenu",
    },
    hardwareProfile:
      "Shenu Intel i5-9400",
  },
  {
    publicId:
      "00000000-0000-0000-0000-000000000102",
    codename: "secondLCS",
    originalName: "segunda.cpp",
    state: "QUEUED",
    resultsReady: false,
    terminal: false,
    canCancel: false,
    queuePosition: 2,
    measurementNode: null,
    hardwareProfile: "",
  },
];

describe("StatusPanel G13.3 execution provenance", () => {
  test("shows registered node/profile for assigned execution", () => {
    render(
      <StatusPanel
        fileList={[
          "longfilenameLCS",
          "secondLCS",
        ]}
        messages={[]}
        executionFiles={executionFiles}
        isSubmitting={true}
        allDone={false}
        allTerminal={false}
        hasError={false}
        hasFailure={false}
        hasCancelled={false}
        submissionError=""
        firstErrorMessage=""
        pollingRequestError=""
        summary={summary}
        isSubmitDisabled={true}
        requirements={[]}
        onGoToResults={jest.fn()}
        onReset={jest.fn()}
        onPrepareNewAnalysis={jest.fn()}
        onPrepareRetry={jest.fn()}
        onRetryPolling={jest.fn()}
        cancellationState={{}}
        onCancelExecution={jest.fn()}
      />
    );

    const filename = screen.getByText(
      "implementacion_con_nombre_muy_largo.cpp"
    );

    expect(filename).toHaveAttribute(
      "title",
      "implementacion_con_nombre_muy_largo.cpp"
    );

    expect(
      screen.getByText("Nodo: Shenu")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Perfil registrado: Shenu Intel i5-9400"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(/hardware observado/i)
    ).not.toBeInTheDocument();

    const runningProgress = screen.getByRole(
      "list",
      {
        name:
          "Progreso de ejecución: implementacion_con_nombre_muy_largo.cpp",
      }
    );

    expect(runningProgress).toHaveTextContent(
      "En cola"
    );
    expect(runningProgress).toHaveTextContent(
      "Ejecutando análisis"
    );
    expect(runningProgress).toHaveTextContent(
      "Procesando resultados"
    );
    expect(runningProgress).toHaveTextContent(
      "Resultados disponibles"
    );
    expect(
      runningProgress.querySelector(
        '[aria-current="step"]'
      )
    ).toHaveTextContent("Ejecutando análisis");
  });
});
