import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

import TestTypeAndParamsCard from "./TestTypeAndParamsCard";

const tasks = [
  { id: "lcs", title: "Text input", description: "LCS" },
  { id: "camm", title: "Numerical input", description: "CAMM" },
  { id: "size", title: "Input size", description: "SIZE" },
];

const noop = jest.fn();

const policyInputLimits = {
  min: 100,
  max: 1000,
  step: 100,
  recommendedMax: 750,
  defaultValue: 500,
  operationalTimeoutSeconds: 960,
};

const renderCard = ({
  inputSize = 500,
  inputLimits = policyInputLimits,
  onInputSizeSliderChange = noop,
} = {}) =>
  render(
    <TestTypeAndParamsCard
      tasks={tasks}
      selectedTaskType="lcs"
      onTaskChange={noop}
      inputSize={inputSize}
      samples={10}
      onInputSizeChange={noop}
      onInputSizeSliderChange={onInputSizeSliderChange}
      onSamplesChange={noop}
      onSamplesSliderChange={noop}
      paramErrors={{}}
      inputSizePresets={{
        lcs: [500, 750, 1000],
        camm: [2000, 5000, 10000],
        size: [1000, 2500, 5000],
      }}
      numericalInputOptions={[
        {
          value: "cammr",
          label: "Números aleatorios",
        },
        {
          value: "cammso",
          label: "Números semiordenados",
        },
        {
          value: "camms",
          label: "Números iguales",
        },
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
      taskBadges={{
        lcs: "LCS",
        camm: "CAMM",
        size: "SIZE",
      }}
      inputSizeHelp={{
        lcs: "",
        camm: "",
        size: "",
      }}
      paramLimits={{
        lcs: {
          inputSize: inputLimits,
          samples: {
            min: 1,
            max: 100,
            step: 1,
          },
        },
        camm: {
          inputSize: inputLimits,
          samples: {
            min: 1,
            max: 100,
            step: 1,
          },
        },
        size: {
          inputSize: inputLimits,
          samples: {
            min: 1,
            max: 100,
            step: 1,
          },
        },
      }}
      executionProfile="rapido"
    />
  );

describe("TestTypeAndParamsCard policy UX", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the real compact benchmark guidance collapsed by default", () => {
    const { container } = renderCard();

    const help = container.querySelector(
      ".benchmark-help-popover"
    );

    expect(help).toBeInTheDocument();
    expect(help).not.toHaveAttribute("open");

    expect(
      within(help).getByText("LCS")
    ).toBeInTheDocument();

    expect(
      within(help).getByText("CAMM")
    ).toBeInTheDocument();

    expect(
      within(help).getByText("SIZE")
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        "Guía rápida de benchmarks"
      )
    ).toBeInTheDocument();
  });

  test("shows the complete effective operational policy", () => {
    renderCard();

    expect(
      screen.getByLabelText(
        "Política operacional efectiva"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("policy-minimum-input")
    ).toHaveTextContent("100");

    expect(
      screen.getByTestId("policy-default-input")
    ).toHaveTextContent("500");

    expect(
      screen.getByTestId(
        "policy-recommended-max-input"
      )
    ).toHaveTextContent("750");

    expect(
      screen.getByTestId("policy-hard-max-input")
    ).toHaveTextContent("1000");

    expect(
      screen.getByTestId("policy-input-step")
    ).toHaveTextContent("100");

    expect(
      screen.getByTestId(
        "policy-operational-timeout"
      )
    ).toHaveTextContent("960 s · 16 min");

    expect(
      screen.getByText(
        /máximo absoluto.*límite de aceptación/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /no es una estimación de duración.*ETA/i
      )
    ).toBeInTheDocument();
  });

  test("preset chips are suggestions, not the recommended range", () => {
    const onInputSizeSliderChange = jest.fn();

    renderCard({
      onInputSizeSliderChange,
    });

    expect(
      screen.getByText("Valores sugeridos")
    ).toBeInTheDocument();

    // 1000 está sobre recommendedMax=750,
    // pero sigue dentro de hardMax=1000.
    const advancedPreset = screen.getByRole(
      "button",
      { name: "1000" }
    );

    expect(advancedPreset).toBeInTheDocument();

    fireEvent.click(advancedPreset);

    expect(
      onInputSizeSliderChange
    ).toHaveBeenCalledWith({
      target: { value: 1000 },
    });
  });

  test("represents an unaligned absolute maximum at the slider endpoint", () => {
    const onInputSizeSliderChange = jest.fn();
    const inputLimits = {
      ...policyInputLimits,
      max: 750,
      recommendedMax: 500,
    };

    const { container } = renderCard({
      inputSize: 750,
      inputLimits,
      onInputSizeSliderChange,
    });

    const slider = container.querySelector(
      'input[type="range"].param-range'
    );

    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("max", "750");
    expect(slider).toHaveAttribute("step", "any");
    expect(slider).toHaveValue("750");

    fireEvent.change(slider, {
      target: { value: "749" },
    });

    expect(
      onInputSizeSliderChange
    ).toHaveBeenCalledWith({
      target: { value: 750 },
    });
  });

  test("marks values above recommended as valid advanced range", () => {
    renderCard({ inputSize: 1000 });

    const advisory = screen.getByRole("status");

    expect(advisory).toHaveTextContent(
      "Tamaño avanzado"
    );

    expect(advisory).toHaveTextContent(
      "máximo recomendado (750)"
    );

    expect(advisory).toHaveTextContent(
      "máximo absoluto (1000)"
    );

    expect(advisory).toHaveTextContent(
      /rango avanzado/i
    );
  });
});
