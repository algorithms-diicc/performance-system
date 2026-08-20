import React from "react";
import { render, screen } from "@testing-library/react";

import { I18nProvider } from "../../../i18n";
import AcademicCourseCard from "./AcademicCourseCard";
import OverviewModal from "./OverviewModal";
import TestTypeAndParamsCard from "./TestTypeAndParamsCard";

const noop = () => {};

const task = {
  id: "camm",
  title: "Fallback CAMM",
  description: "Fallback description",
};

const commonBenchmarkProps = {
  tasks: [task],
  selectedTaskType: "camm",
  onTaskChange: noop,
  inputSize: 5000,
  samples: 30,
  onInputSizeChange: noop,
  onInputSizeSliderChange: noop,
  onSamplesChange: noop,
  onSamplesSliderChange: noop,
  paramErrors: { inputSize: "", samples: "" },
  inputSizePresets: { camm: [2000, 5000] },
  samplesPresets: [10, 20, 30],
  numericalInputOptions: [
    { value: "cammr", label: "Números aleatorios" },
  ],
  dataType: "cammr",
  onDataTypeChange: noop,
  taskDisplayNames: { camm: "Datos numéricos" },
  taskSubtitles: { camm: "Texto español" },
  taskDescriptions: { camm: "Descripción española" },
  taskIcons: { camm: "🔢" },
  taskBadges: { camm: "Dataset numérico" },
  inputSizeHelp: { camm: "Ayuda española" },
  paramLimits: {
    camm: {
      inputSize: { min: 1000, max: 150000, step: 1000 },
      samples: { min: 1, max: 100, step: 1 },
    },
  },
  executionProfile: "Equilibrado",
};

describe("RenderForm configuration i18n", () => {
  test("localizes benchmark presentation from technical ids", () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestTypeAndParamsCard {...commonBenchmarkProps} />
      </I18nProvider>
    );

    expect(screen.getByText("Numeric data")).toBeInTheDocument();
    expect(screen.getByText("Numeric dataset")).toBeInTheDocument();
    expect(screen.getByText("Random numbers")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Decrease repetitions")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The current profile is Balanced/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Datos numéricos")
    ).not.toBeInTheDocument();
  });

  test("localizes academic context while preserving course data", () => {
    render(
      <I18nProvider initialLanguage="en">
        <AcademicCourseCard
          courses={[
            {
              id: 7,
              code: "CC4102",
              name: "Diseño y Análisis de Algoritmos",
              academicYear: 2026,
              academicTerm: 2,
              teacher: { fullName: "Grace Hopper" },
            },
          ]}
          loading={false}
          error=""
          selectedCourseId="7"
          selectionRequired={false}
          onCourseChange={noop}
          onRetry={noop}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Academic context")).toBeInTheDocument();
    expect(screen.getByText("Associated course")).toBeInTheDocument();
    expect(screen.getByText("Automatic")).toBeInTheDocument();
    expect(screen.getByText("Professor: Grace Hopper")).toBeInTheDocument();
    expect(
      screen.getByText("Diseño y Análisis de Algoritmos")
    ).toBeInTheDocument();
  });

  test("localizes overview labels using technical identifiers", () => {
    render(
      <I18nProvider initialLanguage="en">
        <OverviewModal
          visible
          onCancel={noop}
          onConfirm={noop}
          isSubmitting={false}
          testName="Mi experimento"
          fileName="code.zip"
          taskTitle="Datos numéricos"
          taskId="camm"
          inputSize={5000}
          inputLimits={{ min: 1000, max: 150000 }}
          samples={30}
          sampleLimits={{ min: 1, max: 100 }}
          dataTypeLabel="Números aleatorios"
          dataType="cammr"
          environmentLabel="Entorno de medición administrado"
          executionProfileLabel="Equilibrado"
          executionProfileId="equilibrado"
          courseLabel="CC4102 · 2026-2"
          hasCourse
          username="student@udec.cl"
        />
      </I18nProvider>
    );

    expect(screen.getByText("Review experiment")).toBeInTheDocument();
    expect(screen.getByText("Numeric data")).toBeInTheDocument();
    expect(screen.getByText("Random numbers")).toBeInTheDocument();
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(
      screen.getByText("Managed measurement environment")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm and run" })
    ).toBeInTheDocument();
  });
});
