import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { I18nProvider } from "../../../i18n";
import StatusPanel from "../components/StatusPanel";
import useExecutionPolling from "./useExecutionPolling";
import useZipAnalysis from "./useZipAnalysis";

const noop = () => {};

const summary = {
  fileName: "code.zip",
  taskTitle: "Numeric data",
  inputSizeLabel: "5000 values",
  samplesLabel: "30 per point",
  profileLabel: "Balanced",
  environmentLabel: "Managed measurement environment",
  dataTypeLabel: "Random numbers",
};

function renderStatus(props = {}) {
  return render(
    <I18nProvider initialLanguage="en">
      <StatusPanel
        fileList={[]}
        messages={[]}
        executionFiles={[]}
        isSubmitting={false}
        allDone={false}
        allTerminal={false}
        hasError={false}
        submissionError=""
        firstErrorMessage=""
        pollingRequestError=""
        summary={summary}
        isSubmitDisabled={false}
        onGoToResults={noop}
        onReset={noop}
        onPrepareRetry={noop}
        onRetryPolling={noop}
        {...props}
      />
    </I18nProvider>
  );
}

function ZipHarness() {
  const {
    fileError,
    handleFileInputChange,
  } = useZipAnalysis();

  return (
    <>
      <input
        aria-label="archive"
        type="file"
        onChange={handleFileInputChange}
      />
      <div role="alert">{fileError}</div>
    </>
  );
}

const POLLING_FILES = ["exec-a"];
const POLLING_RECORDS = [{ codename: "exec-a" }];

function PollingHarness() {
  const { firstErrorMessage } =
    useExecutionPolling(
      POLLING_FILES,
      POLLING_RECORDS,
      100000
    );

  return <div>{firstErrorMessage}</div>;
}

describe("RenderForm workflow i18n", () => {
  test("localizes the ready status panel", () => {
    renderStatus();

    expect(
      screen.getByRole("heading", {
        name: "Experiment summary",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Configuration ready")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Review and run/i,
      })
    ).toBeInTheDocument();
  });

  test("localizes completed and friendly compilation-error states", () => {
    const view = renderStatus({
      fileList: ["exec-a"],
      executionFiles: [
        {
          codename: "exec-a",
          resultsReady: true,
        },
      ],
      allDone: true,
      allTerminal: true,
    });

    expect(
      screen.getByRole("heading", {
        name: "Analysis completed",
      })
    ).toBeInTheDocument();

    view.unmount();

    renderStatus({
      fileList: ["exec-a"],
      allTerminal: true,
      hasError: true,
      firstErrorMessage: "Error de compilación",
    });

    expect(
      screen.getByText(
        /The code could not compile successfully/i
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Error de compilación")
    ).not.toBeInTheDocument();
  });

  test("keeps raw technical log messages unchanged", () => {
    renderStatus({
      fileList: ["exec-a"],
      messages: [
        {
          codename: "exec-a",
          originalName: "student.cpp",
          status: "RUNNING",
          messages: [
            {
              time: "10:20:30",
              msg: "compilando código del estudiante",
            },
          ],
        },
      ],
      executionFiles: [
        {
          codename: "exec-a",
          resultsReady: false,
        },
      ],
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: /Technical details/i,
      })
    );

    expect(
      screen.getByText(
        "compilando código del estudiante"
      )
    ).toBeInTheDocument();
  });

  test("localizes ZIP validation errors and missing polling identifiers", async () => {
    const zipView = render(
      <I18nProvider initialLanguage="en">
        <ZipHarness />
      </I18nProvider>
    );

    const invalidFile = new File(
      ["not zip"],
      "source.txt",
      { type: "text/plain" }
    );

    fireEvent.change(
      screen.getByLabelText("archive"),
      {
        target: {
          files: [invalidFile],
        },
      }
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toHaveTextContent(
        "The file must have a .zip extension."
      );
    });

    zipView.unmount();

    render(
      <I18nProvider initialLanguage="en">
        <PollingHarness />
      </I18nProvider>
    );

    expect(
      await screen.findByText(
        "The server did not return the persistent execution identifier."
      )
    ).toBeInTheDocument();
  });
});
