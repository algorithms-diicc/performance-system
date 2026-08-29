import React from "react";
import fs from "fs";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import {
  requestJson,
} from "../common/requestErrorModel";
import { I18nProvider } from "../i18n";
import AdminSystemStatus from "./AdminSystemStatus";


jest.mock(
  "../common/requestErrorModel",
  () => ({
    ...jest.requireActual("../common/requestErrorModel"),
    requestJson: jest.fn(),
  })
);


const payload = (queued = 4) => ({
  checkedAt: "2026-08-22T13:30:00-04:00",
  backend: { status: "AVAILABLE" },
  database: { status: "AVAILABLE" },
  queue: {
    queued,
    running: 1,
    processing: 2,
    oldestQueuedAt: "2026-08-22T09:15:30",
    staleActive: 1,
    latestCompletedAt: "2026-08-22T10:20:30",
    latestFailedAt: "2026-08-22T11:25:35",
  },
  runtime: {
    executionMode: "local",
    heartbeatSeconds: 10,
    activeStaleSeconds: 90,
  },
  processSignals: {
    dispatcher: { signal: "LOCK_OBSERVED" },
    watchdog: { signal: "LOCK_NOT_OBSERVED" },
  },
  measurementNodes: {
    status: "AVAILABLE",
    items: [
      {
        key: "shenu",
        name: "Shenu",
        state: "AVAILABLE",
        hardwareProfile: {
          key: "shenu-intel-i5-9400",
          name: "Shenu Intel i5-9400",
        },
        enabled: true,
        validationOnly: false,
        draining: false,
        lastHeartbeatAt: "2026-08-22T13:29:50",
        heartbeatAgeSeconds: 10,
      },
      {
        key: "ryzen-validation",
        name: "Ryzen validation",
        state: "OFFLINE",
        hardwareProfile: {
          key: "ryzen-amd-ryzen-5-3600",
          name: "Ryzen AMD Ryzen 5 3600",
        },
        enabled: false,
        validationOnly: true,
        draining: false,
        lastHeartbeatAt: "2026-08-22T13:29:55",
        heartbeatAgeSeconds: 5,
      },
    ],
  },
  measurementEnvironment: {
    source: "LATEST_PERSISTED_EXECUTION",
    historical: true,
    observedAt: "2026-08-22T11:30:40",
    snapshotSchemaVersion: "1.0",
    cpuModel: "AMD EPYC 7763",
    architecture: "x86_64",
    logicalCpus: 16,
    perfVersion: "perf version 6.8.0",
    perfEventParanoid: "2",
    energy: {
      package: {
        eventExposed: true,
        probeState: "numeric",
        measurementAvailable: true,
      },
      cores: {
        eventExposed: true,
        probeState: "permission_denied",
        measurementAvailable: false,
      },
      ram: {
        eventExposed: false,
        probeState: "event_not_exposed",
        measurementAvailable: false,
      },
    },
  },
});


const renderStatus = () =>
  render(
    <I18nProvider initialLanguage="en">
      <AdminSystemStatus />
    </I18nProvider>
  );


function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}


describe("AdminSystemStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("performs one authenticated request on mount and renders the accepted signals", async () => {
    requestJson.mockResolvedValue(payload());

    renderStatus();

    expect(
      await screen.findByRole("heading", { name: "System status" })
    ).toBeInTheDocument();
    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(requestJson).toHaveBeenCalledWith(
      "/api/admin/system-status",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
      expect.any(Object)
    );
    expect(screen.getByText("Execution queue")).toBeInTheDocument();
    expect(screen.getByText("Auxiliary processes")).toBeInTheDocument();
    expect(
      screen.getByText("Registered measurement nodes")
    ).toBeInTheDocument();
    expect(screen.getByText("Shenu")).toBeInTheDocument();
    expect(
      screen.getByText("Shenu Intel i5-9400")
    ).toBeInTheDocument();
    expect(screen.getByText("Ryzen validation")).toBeInTheDocument();

    const shenuCard = screen.getByRole("article", {
      name: "Measurement node Shenu",
    });
    const ryzenCard = screen.getByRole("article", {
      name: "Measurement node Ryzen validation",
    });

    expect(
      within(shenuCard).getByText("Available")
    ).toBeInTheDocument();
    expect(
      within(shenuCard)
        .getByText("Enabled")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("Yes");
    expect(
      within(shenuCard)
        .getByText("Draining mode")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("No");

    expect(
      within(ryzenCard).getByText("Offline")
    ).toBeInTheDocument();
    expect(
      within(ryzenCard)
        .getByText("Enabled")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("No");
    expect(
      within(ryzenCard)
        .getByText("Draining mode")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("No");

    expect(
      screen.getAllByText("Validation only")
    ).toHaveLength(2);
    expect(screen.getByText("AMD EPYC 7763")).toBeInTheDocument();
    expect(screen.getByText("x86_64")).toBeInTheDocument();
    expect(screen.getByText("perf version 6.8.0")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "code" })).toBeInTheDocument();
    expect(screen.getByText("Numeric sample")).toBeInTheDocument();
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(screen.getByText("Event not exposed")).toBeInTheDocument();
  });


  test("formats heartbeat age as concise operational time", async () => {
    const response = payload();

    response.measurementNodes.items[0] = {
      ...response.measurementNodes.items[0],
      heartbeatAgeSeconds: 35403.938184,
    };
    response.measurementNodes.items[1] = {
      ...response.measurementNodes.items[1],
      heartbeatAgeSeconds: 4.093501,
    };

    requestJson.mockResolvedValue(response);
    renderStatus();

    const shenuCard = await screen.findByRole(
      "article",
      {
        name: "Measurement node Shenu",
      }
    );
    const ryzenCard = screen.getByRole(
      "article",
      {
        name: "Measurement node Ryzen validation",
      }
    );

    expect(
      within(shenuCard).getByText("9 h 50 min")
    ).toBeInTheDocument();

    expect(
      within(ryzenCard).getByText("4 s")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("35403.938184")
    ).not.toBeInTheDocument();
  });

  test("renders DRAINING as the canonical operational state without inventing a DISABLED state", async () => {
    const response = payload();
    response.measurementNodes.items[0] = {
      ...response.measurementNodes.items[0],
      state: "DRAINING",
      enabled: true,
      draining: true,
    };

    requestJson.mockResolvedValue(response);
    renderStatus();

    const shenuCard = await screen.findByRole(
      "article",
      {
        name: "Measurement node Shenu",
      }
    );

    expect(
      within(shenuCard).getByText("Draining")
    ).toBeInTheDocument();
    expect(
      within(shenuCard)
        .getByText("Enabled")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("Yes");
    expect(
      within(shenuCard)
        .getByText("Draining mode")
        .closest(".admin-system-status__field")
    ).toHaveTextContent("Yes");

    expect(
      screen.queryByText("Disabled")
    ).not.toBeInTheDocument();
  });

  test("keeps live node inventory separate from historical measurement evidence", async () => {
    const response = payload();
    response.measurementNodes = {
      status: "UNKNOWN",
      items: [],
    };

    requestJson.mockResolvedValue(response);
    renderStatus();

    expect(
      await screen.findByText(
        "The measurement-node inventory is unavailable for this refresh."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("AMD EPYC 7763")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /historical.*do not represent live health/i
      )
    ).toBeInTheDocument();
  });

  test("manual refresh preserves the last valid response until the next one arrives", async () => {
    const refresh = deferred();
    requestJson
      .mockResolvedValueOnce(payload(4))
      .mockReturnValueOnce(refresh.promise);

    renderStatus();

    expect(await screen.findByText("4", { selector: "strong" }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(screen.getByText("4", { selector: "strong" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refreshing…" }))
      .toBeDisabled();

    await act(async () => {
      refresh.resolve(payload(8));
      await refresh.promise;
    });

    expect(await screen.findByText("8", { selector: "strong" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" }))
      .toBeEnabled();
  });

  test("shows an inline error and retries without automatic polling", async () => {
    const requestError = new Error("internal raw error");
    requestError.status = 500;
    requestJson
      .mockRejectedValueOnce(requestError)
      .mockResolvedValueOnce(payload());

    renderStatus();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The diagnostic could not be refreshed"
    );
    const componentSource = fs.readFileSync(
      require.resolve("./AdminSystemStatus"),
      "utf8"
    );
    expect(componentSource).not.toContain("setInterval");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("heading", { name: "Execution queue" })
    ).toBeInTheDocument();
    await waitFor(() => expect(requestJson).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(componentSource).not.toContain("setTimeout");
  });

  test("keeps valid data visible when a manual refresh fails", async () => {
    const requestError = new Error("refresh failed");
    requestError.status = 503;
    requestJson
      .mockResolvedValueOnce(payload(4))
      .mockRejectedValueOnce(requestError);

    renderStatus();
    expect(await screen.findByText("AMD EPYC 7763")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("AMD EPYC 7763")).toBeInTheDocument();
    expect(screen.getByText("4", { selector: "strong" }))
      .toBeInTheDocument();
  });
});
