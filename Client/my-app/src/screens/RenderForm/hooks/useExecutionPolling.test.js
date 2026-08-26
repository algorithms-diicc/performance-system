import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

import { I18nProvider } from "../../../i18n";
import useExecutionPolling from "./useExecutionPolling";

jest.mock("axios");

const FILES = ["exec-a"];
const RECORDS = [
  {
    publicId: "public-a",
    codename: "exec-a",
    originalFilename: "student.cpp",
  },
];

const MULTI_FILES = [
  "exec-a",
  "exec-b",
];

const MULTI_RECORDS = [
  {
    publicId: "public-a",
    codename: "exec-a",
  },
  {
    publicId: "public-b",
    codename: "exec-b",
  },
];

function PollingHarness() {
  const { executionFiles } = useExecutionPolling(
    FILES,
    RECORDS,
    100000
  );

  const execution = executionFiles[0];

  return (
    <div>
      <span data-testid="state">{execution?.state || ""}</span>
      <span data-testid="queue-ahead">
        {execution?.queueAhead ?? ""}
      </span>
    </div>
  );
}

function MultiPollingHarness() {
  const { executionFiles, allTerminal, hasFailure, hasCancelled } =
    useExecutionPolling(
      MULTI_FILES,
      MULTI_RECORDS,
      5
    );

  return (
    <div>
      <span data-testid="multi-states">
        {executionFiles.map((item) => item.state).join(",")}
      </span>
      <span data-testid="multi-terminal">{String(allTerminal)}</span>
      <span data-testid="multi-failure">{String(hasFailure)}</span>
      <span data-testid="multi-cancelled">{String(hasCancelled)}</span>
    </div>
  );
}

describe("useExecutionPolling queue snapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updates queueAhead from the existing status request only", async () => {
    axios.get.mockResolvedValue({
      data: {
        execution: {
          publicId: "public-a",
          codename: "exec-a",
          originalFilename: "student.cpp",
          state: "QUEUED",
          queueAhead: 2,
          terminal: false,
          resultAvailable: false,
        },
      },
    });

    render(
      <I18nProvider initialLanguage="en">
        <PollingHarness />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("state")).toHaveTextContent("QUEUED");
      expect(screen.getByTestId("queue-ahead")).toHaveTextContent("2");
    });

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain(
      "api/executions/public-a"
    );
  });

  test("a cancelled execution does not stop polling its running sibling", async () => {
    let publicBRequests = 0;

    axios.get.mockImplementation((url) => {
      const isCancelled =
        String(url).includes("public-a");

      if (!isCancelled) {
        publicBRequests += 1;
      }

      return Promise.resolve({
        data: {
          execution: isCancelled
            ? {
                publicId: "public-a",
                codename: "exec-a",
                state: "CANCELLED",
                terminal: true,
              }
            : publicBRequests === 1
            ? {
                publicId: "public-b",
                codename: "exec-b",
                state: "RUNNING",
                terminal: false,
              }
            : {
                publicId: "public-b",
                codename: "exec-b",
                state: "COMPLETED",
                terminal: true,
                resultAvailable: true,
              },
        },
      });
    });

    render(
      <I18nProvider initialLanguage="en">
        <MultiPollingHarness />
      </I18nProvider>
    );

    await waitFor(() => {
      expect(publicBRequests).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId("multi-states")).toHaveTextContent(
        "CANCELLED,COMPLETED"
      );
      expect(screen.getByTestId("multi-terminal")).toHaveTextContent("true");
      expect(screen.getByTestId("multi-failure")).toHaveTextContent("false");
      expect(screen.getByTestId("multi-cancelled")).toHaveTextContent("true");
    });
  });
});
