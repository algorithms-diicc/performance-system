import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import { I18nProvider } from "../../i18n";
import ComparisonAuditPanel from "./ComparisonAuditPanel";

const baseDimensions = {
  benchmark: { status: "MATCH" },
  hardware: { status: "MATCH" },
  measurementBackend: { status: "MATCH" },
  profile: { status: "MATCH" },
  protocol: { status: "MATCH" },
  sourceToolchain: {
    status: "MATCH",
    versionStatus: "MATCH",
  },
  compilerFlags: { status: "MATCH" },
  sourceProvenance: { status: "VERIFIED" },
  inputSizes: { status: "MATCH" },
  metrics: { status: "MATCH" },
};

const renderAudit = ({
  compatibility,
  language = "es",
  open = false,
} = {}) => {
  const onToggle = jest.fn();
  const result = render(
    <I18nProvider initialLanguage={language}>
      <ComparisonAuditPanel
        compatibility={{
          status: "COMPATIBLE",
          dimensions: baseDimensions,
          blockers: [],
          warnings: [],
          excludedMetrics: [],
          ...compatibility,
        }}
        open={open}
        onToggle={onToggle}
      />
    </I18nProvider>
  );

  return {
    ...result,
    onToggle,
  };
};

describe("ComparisonAuditPanel", () => {
  test("keeps the compact audit informative while collapsed", () => {
    const { onToggle } = renderAudit({
      compatibility: {
        status: "LIMITED",
        dimensions: {
          ...baseDimensions,
          metrics: { status: "LIMITED" },
        },
        warnings: [
          {
            code: "TARGET_METRIC_UNAVAILABLE",
            dimension: "metrics",
            metric: "EnergyPkg",
            message:
              "La métrica objetivo no es comparable en todas las ejecuciones.",
          },
        ],
        excludedMetrics: [
          {
            metric: "EnergyPkg",
            reasonCode: "TARGET_METRIC_UNAVAILABLE",
            message:
              "La métrica objetivo no existe en todas las ejecuciones.",
          },
        ],
      },
    });

    const button = screen.getByRole("button", {
      name: "Mostrar detalle",
    });
    expect(button).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(
      document.getElementById("comparison-audit-body")
    ).toHaveAttribute("hidden");

    const summary = screen.getByLabelText(
      "Resumen de la auditoría de comparabilidad"
    );
    expect(
      within(summary).getByText("Métricas excluidas")
    ).toBeInTheDocument();

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test("deduplicates metric warnings already represented by an excluded metric", () => {
    renderAudit({
      open: true,
      compatibility: {
        status: "LIMITED",
        dimensions: {
          ...baseDimensions,
          metrics: { status: "LIMITED" },
        },
        warnings: [
          {
            code: "METRIC_UNIT_MISMATCH",
            dimension: "metrics",
            metric: "EnergyPkg",
            message:
              "La unidad de la métrica objetivo no coincide.",
          },
          {
            code: "TARGET_METRIC_UNAVAILABLE",
            dimension: "metrics",
            metric: "EnergyPkg",
            message:
              "La métrica objetivo no es comparable en todas las ejecuciones.",
          },
        ],
        excludedMetrics: [
          {
            metric: "EnergyPkg",
            reasonCode: "METRIC_UNIT_MISMATCH",
            message:
              "La métrica fue excluida porque sus unidades no coinciden.",
          },
        ],
      },
    });

    const audit = document.getElementById(
      "comparison-audit-body"
    );
    expect(
      within(audit).getAllByText(
        "Energía del paquete CPU"
      )
    ).toHaveLength(1);
    expect(
      within(audit).getByText(
        /unidad reportada no coincide/
      )
    ).toBeInTheDocument();
    expect(
      within(audit).queryByText(
        /no es comparable en todas las ejecuciones/
      )
    ).not.toBeInTheDocument();
  });

  test("keeps partial coverage as one metric-specific audit observation", () => {
    renderAudit({
      open: true,
      compatibility: {
        status: "LIMITED",
        dimensions: {
          ...baseDimensions,
          metrics: { status: "LIMITED" },
        },
        warnings: [
          {
            code: "METRIC_PARTIAL_COVERAGE",
            dimension: "metrics",
            metric: "IPC",
            message:
              "La métrica sólo cubre parte de los InputSize comunes.",
          },
        ],
      },
    });

    expect(
      screen.getByText(
        "La métrica sólo cubre parte de los InputSize comunes."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("METRIC_PARTIAL_COVERAGE")
    ).toBeInTheDocument();
  });

  test("localizes backend issue codes instead of surfacing Spanish backend messages in English", () => {
    renderAudit({
      language: "en",
      open: true,
      compatibility: {
        status: "LIMITED",
        dimensions: {
          ...baseDimensions,
          inputSizes: { status: "PARTIAL" },
        },
        warnings: [
          {
            code: "PARTIAL_INPUT_OVERLAP",
            dimension: "inputSizes",
            message:
              "Las ejecuciones sólo comparten una parte de los InputSize medidos.",
          },
        ],
      },
    });

    expect(
      screen.getByText(
        "The executions share only part of the measured InputSize domain."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Las ejecuciones sólo comparten una parte de los InputSize medidos."
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Comparability audit",
      })
    ).toBeInTheDocument();
  });

  test("humanizes a C versus C++ warning without exposing the backend message", () => {
    renderAudit({
      language: "en",
      open: true,
      compatibility: {
        status: "LIMITED",
        dimensions: {
          ...baseDimensions,
          sourceToolchain: {
            status: "DIFFERS",
            verified: true,
            versionStatus: "MATCH",
          },
        },
        warnings: [
          {
            code: "SOURCE_TOOLCHAIN_DIFFERS",
            dimension: "sourceToolchain",
            message: "MENSAJE BACKEND NO MOSTRAR",
          },
        ],
      },
    });

    expect(
      screen.getAllByText("Language and compiler").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/different languages or compilers/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("MENSAJE BACKEND NO MOSTRAR")
    ).not.toBeInTheDocument();
  });
});
