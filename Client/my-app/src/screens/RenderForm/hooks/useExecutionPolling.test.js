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
});
