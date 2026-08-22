import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { I18nProvider } from "../../../i18n";
import StatusPanel from "../components/StatusPanel";
import TestTypeAndParamsCard from "../components/TestTypeAndParamsCard";
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
        onPrepareNewAnalysis={noop}
        onPrepareRetry={noop}
        onRetryPolling={noop}
        {...props}
      />
    </I18nProvider>
  );
}

function ParamsHarness() {
  return (
    <I18nProvider initialLanguage="en">
      <TestTypeAndParamsCard
        tasks={[
          {
            id: "size",
            title: "Parameterized size",
            description: "Parameterized benchmark",
          },
        ]}
        selectedTaskType="size"
        onTaskChange={noop}
        inputSize={6000}
        samples={30}
        onInputSizeChange={noop}
        onInputSizeSliderChange={noop}
        onSamplesChange={noop}
        onSamplesSliderChange={noop}
        paramErrors={{ inputSize: "", samples: "" }}
        inputSizePresets={{
          size: [1000, 2500, 5000],
        }}
        numericalInputOptions={[]}
        dataType=""
        onDataTypeChange={noop}
        taskDisplayNames={{
          size: "Parameterized size",
        }}
        taskSubtitles={{
          size: "Integer argument benchmark",
        }}
        taskDescriptions={{
          size: "Uses an integer problem size.",
        }}
        taskIcons={{ size: "📏" }}
        taskBadges={{ size: "Integer argument" }}
        inputSizeHelp={{
          size: "Maximum integer argument.",
        }}
        paramLimits={{
          size: {
            inputSize: {
              min: 100,
              max: 100000,
              step: 100,
            },
            samples: {
              min: 1,
              max: 100,
              step: 1,
            },
          },
        }}
        executionProfile="equilibrado"
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

  test("lists only the exact pending readiness requirements", () => {
    renderStatus({
      isSubmitDisabled: true,
      requirements: ["zipRequired", "courseRequired"],
    });

    expect(screen.getByText("Select a ZIP archive.")).toBeInTheDocument();
    expect(
      screen.getByText("Select the course for this experiment.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Choose a benchmark.")).not.toBeInTheDocument();
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

  test("running mode exposes a localized non-cancelling next-analysis action", () => {
    const onPrepareNewAnalysis = jest.fn();

    renderStatus({
      fileList: ["exec-a"],
      isSubmitting: true,
      executionFiles: [
        {
          codename: "exec-a",
          resultsReady: false,
        },
      ],
      onPrepareNewAnalysis,
    });

    expect(
      screen.getByRole("button", {
        name: "Prepare another analysis",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/does not cancel this execution/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Prepare another analysis",
      })
    );

    expect(onPrepareNewAnalysis).toHaveBeenCalledTimes(1);
  });

  test("localizes semantic polling events in technical details", () => {
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
              key: "running",
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
      screen.getByText("The measurement node started the execution.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Enviando test al slave/i)).not.toBeInTheDocument();
  });

  test("shows per-execution FIFO positions for zero, one and many ahead", () => {
    renderStatus({
      fileList: ["exec-a", "exec-b", "exec-c"],
      isSubmitting: true,
      executionFiles: [
        {
          publicId: "p-a",
          codename: "exec-a",
          originalName: "a.cpp",
          state: "QUEUED",
          queueAhead: 0,
          resultsReady: false,
        },
        {
          publicId: "p-b",
          codename: "exec-b",
          originalName: "b.cpp",
          state: "QUEUED",
          queueAhead: 1,
          resultsReady: false,
        },
        {
          publicId: "p-c",
          codename: "exec-c",
          originalName: "c.cpp",
          state: "QUEUED",
          queueAhead: 4,
          resultsReady: false,
        },
      ],
    });

    expect(screen.getByText("Next in queue")).toBeInTheDocument();
    expect(screen.getByText("1 execution ahead")).toBeInTheDocument();
    expect(screen.getByText("4 executions ahead")).toBeInTheDocument();
    expect(screen.getByText(/dispatched in FIFO order/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/\bETA\b|estimated time|minutes remaining/i)
    ).not.toBeInTheDocument();
  });

  test("distinguishes recommended input values from the allowed hard range", () => {
    render(<ParamsHarness />);

    expect(
      screen.getByText("Recommended values")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Allowed range: 100–100000/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /exceeds the largest recommended value \(5000\)/i
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
