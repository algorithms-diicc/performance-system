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
  numericalInputOptions: [
    { value: "cammr", label: "Números aleatorios" },
  ],
  dataType: "cammr",
  onDataTypeChange: noop,
  taskDisplayNames: { camm: "Datos numéricos" },
  taskSubtitles: { camm: "Texto español" },
  taskDescriptions: { camm: "Descripción española" },
  taskBadges: { camm: "Dataset numérico" },
  inputSizeHelp: { camm: "Ayuda española" },
  paramLimits: {
    camm: {
      inputSize: { min: 1000, max: 150000, step: 1000 },
      samples: { min: 1, max: 100, step: 1 },
    },
  },
  executionProfile: "equilibrado",
};

describe("RenderForm configuration i18n", () => {
  test("localizes benchmark presentation from technical ids", () => {
    const { container } = render(
      <I18nProvider initialLanguage="en">
        <TestTypeAndParamsCard {...commonBenchmarkProps} />
      </I18nProvider>
    );

    expect(
      container.querySelector(".label-icon .lucide-flask-conical")
    ).toBeInTheDocument();
    expect(
      container.querySelector(".test-option-icon .lucide-binary")
    ).toBeInTheDocument();

    expect(screen.getByText("Numeric data")).toBeInTheDocument();
    expect(screen.getByText("Numeric dataset")).toBeInTheDocument();
    expect(screen.getByText("Random numbers")).toBeInTheDocument();
    expect(screen.getByTestId("fixed-profile-samples")).toHaveTextContent(
      "30 repetitions per point"
    );
    expect(
      screen.queryByLabelText("Decrease repetitions")
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", {
      name: "Repetitions per point",
    })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Datos numéricos")
    ).not.toBeInTheDocument();
  });

  test("Custom is the only profile exposing 1–100 repetition controls", () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestTypeAndParamsCard
          {...commonBenchmarkProps}
          executionProfile="personalizado"
          samples={40}
        />
      </I18nProvider>
    );

    const inputs = screen.getAllByRole("spinbutton");
    const repetitions = inputs.find(
      (input) => input.getAttribute("min") === "1"
    );

    expect(repetitions).toHaveAttribute("max", "100");
    expect(repetitions).toHaveAttribute("step", "1");
    expect(
      screen.getByLabelText("Decrease repetitions")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: "Repetitions per point" })
    ).toHaveAttribute("max", "100");
    expect(screen.queryByRole("button", { name: "20" })).not.toBeInTheDocument();
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
          fileMeta={{
            cppCount: 7,
            cppSample: ["src/a.cpp", "src/b.cpp", "src/c.cpp", "src/d.cpp", "src/e.cpp"],
          }}
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
    expect(screen.getByText("7 .cpp files")).toBeInTheDocument();
    expect(screen.getByText("src/a.cpp")).toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
    expect(screen.getByText("student@udec.cl")).toBeInTheDocument();
    expect(
      screen.getByText("Managed measurement environment")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm and run" })
    ).toBeInTheDocument();
  });
});
