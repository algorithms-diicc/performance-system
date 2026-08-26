import React from "react";
import { render, screen, within } from "@testing-library/react";

import TestTypeAndParamsCard from "./TestTypeAndParamsCard";

const tasks = [
  { id: "lcs", title: "Text input", description: "LCS" },
  { id: "camm", title: "Numerical input", description: "CAMM" },
  { id: "size", title: "Input size", description: "SIZE" },
];

const noop = jest.fn();

const renderCard = () =>
  render(
    <TestTypeAndParamsCard
      tasks={tasks}
      selectedTaskType="lcs"
      onTaskChange={noop}
      inputSize={1000}
      samples={10}
      onInputSizeChange={noop}
      onInputSizeSliderChange={noop}
      onSamplesChange={noop}
      onSamplesSliderChange={noop}
      paramErrors={{}}
      inputSizePresets={{
        lcs: [500, 750, 1000],
        camm: [2000, 5000, 10000],
        size: [1000, 2500, 5000],
      }}
      numericalInputOptions={[
        { value: "cammr", label: "Números aleatorios" },
        { value: "cammso", label: "Números semiordenados" },
        { value: "camms", label: "Números iguales" },
      ]}
      dataType=""
      onDataTypeChange={noop}
      taskDisplayNames={{
        lcs: "Entrada de texto",
        camm: "Datos numéricos",
        size: "Tamaño parametrizado",
      }}
      taskSubtitles={{
        lcs: "Texto",
        camm: "Números",
        size: "Argumento",
      }}
      taskDescriptions={{
        lcs: "Texto",
        camm: "Números",
        size: "Argumento",
      }}
      taskIcons={{}}
      taskBadges={{ lcs: "LCS", camm: "CAMM", size: "SIZE" }}
      inputSizeHelp={{ lcs: "", camm: "", size: "" }}
      paramLimits={{
        lcs: {
          inputSize: { min: 1, max: 10000, step: 1 },
          samples: { min: 1, max: 100, step: 1 },
        },
        camm: {
          inputSize: { min: 1, max: 10000, step: 1 },
          samples: { min: 1, max: 100, step: 1 },
        },
        size: {
          inputSize: { min: 1, max: 10000, step: 1 },
          samples: { min: 1, max: 100, step: 1 },
        },
      }}
      executionProfile="rapido"
    />
  );

describe("TestTypeAndParamsCard benchmark help", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the real compact benchmark guidance collapsed by default", () => {
    const { container } = renderCard();
    const help = container.querySelector(".benchmark-help-popover");

    expect(help).toBeInTheDocument();
    expect(help).not.toHaveAttribute("open");
    expect(within(help).getByText("LCS")).toBeInTheDocument();
    expect(within(help).getByText("CAMM")).toBeInTheDocument();
    expect(within(help).getByText("SIZE")).toBeInTheDocument();
    expect(screen.getByLabelText("Guía rápida de benchmarks")).toBeInTheDocument();
  });
});
