import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { requestJson } from "../common/requestErrorModel";
import { I18nProvider, useI18n } from "../i18n";
import AdminSystemStatus from "./AdminSystemStatus";


jest.mock(
  "../common/requestErrorModel",
  () => ({
    ...jest.requireActual("../common/requestErrorModel"),
    requestJson: jest.fn(),
  })
);


const LanguageControl = () => {
  const { setLanguage } = useI18n();
  return (
    <button type="button" onClick={() => setLanguage("es")}>
      switch-es
    </button>
  );
};


const payload = (databaseStatus = "AVAILABLE") => ({
  checkedAt: "2026-08-22T13:30:00-04:00",
  backend: { status: "AVAILABLE" },
  database: { status: databaseStatus },
  queue: {
    queued: 0,
    running: 0,
    processing: 0,
    oldestQueuedAt: null,
    staleActive: 0,
    latestCompletedAt: null,
    latestFailedAt: "2026-08-22T11:25:35",
  },
  runtime: {
    executionMode: "remote",
    heartbeatSeconds: 10,
    activeStaleSeconds: 90,
  },
  processSignals: {
    dispatcher: { signal: "LOCK_OBSERVED" },
    watchdog: { signal: "UNKNOWN" },
  },
  measurementNodes: {
    status: "AVAILABLE",
    items: [
      {
        key: "shenu",
        name: "Shenu",
        state: "DRAINING",
        hardwareProfile: {
          key: "shenu-intel-i5-9400",
          name: "Shenu Intel i5-9400",
        },
        enabled: true,
        validationOnly: false,
        draining: true,
        lastHeartbeatAt: "2026-08-22T13:29:50",
        heartbeatAgeSeconds: 10,
      },
    ],
  },
  measurementEnvironment: {
    source: "LATEST_PERSISTED_EXECUTION",
    historical: true,
    observedAt: "2026-08-22T11:30:40",
    snapshotSchemaVersion: "1.0",
    cpuModel: "Authentic Test CPU",
    architecture: "aarch64",
    logicalCpus: 32,
    perfVersion: "perf version TEST-7B",
    perfEventParanoid: "-1",
    energy: {
      package: {
        eventExposed: true,
        probeState: "not_supported",
        measurementAvailable: false,
      },
      cores: {
        eventExposed: true,
        probeState: "not_counted",
        measurementAvailable: false,
      },
      ram: {
        eventExposed: true,
        probeState: "vendor_specific_state",
        measurementAvailable: false,
      },
    },
  },
});


const renderEnglish = () =>
  render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <AdminSystemStatus />
    </I18nProvider>
  );


describe("AdminSystemStatus i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ["AVAILABLE", "Available", "Disponible"],
    ["UNAVAILABLE", "Unavailable", "No disponible"],
    ["UNKNOWN", "Unknown", "Desconocido"],
  ])("localizes database state %s in EN and ES", async (status, en, es) => {
    requestJson.mockResolvedValue(payload(status));
    renderEnglish();

    const databaseCard = await screen.findByText("PostgreSQL");
    expect(within(databaseCard.closest("article")).getByText(en))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch-es" }));

    expect(within(databaseCard.closest("article")).getByText(es))
      .toBeInTheDocument();
    expect(requestJson).toHaveBeenCalledTimes(1);
  });

  test("localizes neutral lock and energy copy while preserving safe technical values", async () => {
    requestJson.mockResolvedValue(payload());
    renderEnglish();

    expect(await screen.findByText("Lock observed")).toBeInTheDocument();
    expect(
      screen.getByText("Registered measurement nodes")
    ).toBeInTheDocument();
    expect(screen.getByText("Draining")).toBeInTheDocument();
    expect(screen.getByText("Hardware profile")).toBeInTheDocument();
    expect(screen.getByText("Validation only")).toBeInTheDocument();
    expect(screen.getByText(
      /point-in-time coordination signal.*does not guarantee progress/i
    )).toBeInTheDocument();
    expect(screen.getByText(
      /data are historical.*do not represent live health/i
    )).toBeInTheDocument();
    expect(screen.getByText(
      /failed Execution.*does not imply a global system failure/i
    )).toBeInTheDocument();
    expect(screen.getByText("Not supported by perf")).toBeInTheDocument();
    expect(screen.getByText("Not counted")).toBeInTheDocument();
    expect(screen.getByText("vendor_specific_state", { selector: "code" }))
      .toBeInTheDocument();
    expect(screen.getByText("Authentic Test CPU", { selector: "code" }))
      .toBeInTheDocument();
    expect(screen.getByText("aarch64", { selector: "code" }))
      .toBeInTheDocument();
    expect(screen.getByText("perf version TEST-7B", { selector: "code" }))
      .toBeInTheDocument();
    expect(screen.getByText("-1", { selector: "code" }))
      .toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch-es" }));

    expect(screen.getByText("Lock observado")).toBeInTheDocument();
    expect(
      screen.getByText("Nodos de medición registrados")
    ).toBeInTheDocument();
    expect(screen.getByText("En drenaje")).toBeInTheDocument();
    expect(screen.getByText("Perfil de hardware")).toBeInTheDocument();
    expect(screen.getByText("Solo validación")).toBeInTheDocument();
    expect(screen.getByText(
      /señal puntual de coordinación.*no garantiza progreso/i
    )).toBeInTheDocument();
    expect(screen.getByText(
      /datos son históricos.*no representan health en vivo/i
    )).toBeInTheDocument();
    expect(screen.getByText("No soportado por perf")).toBeInTheDocument();
    expect(screen.getByText("No contabilizado")).toBeInTheDocument();
    expect(screen.getByText("vendor_specific_state", { selector: "code" }))
      .toBeInTheDocument();
    expect(requestJson).toHaveBeenCalledTimes(1);
  });
});
