import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";

import TestTypeAndParamsCard from "./TestTypeAndParamsCard";

const noop = jest.fn();

const renderPolicyCard = (inputSize = 1000) =>
  render(
    <TestTypeAndParamsCard
      tasks={[
        {
          id: "lcs",
          title: "LCS",
          description: "LCS",
        },
      ]}
      selectedTaskType="lcs"
      onTaskChange={noop}
      inputSize={inputSize}
      samples={10}
      onInputSizeChange={noop}
      onInputSizeSliderChange={noop}
      onSamplesChange={noop}
      onSamplesSliderChange={noop}
      paramErrors={{}}
      inputSizePresets={{
        lcs: [500, 750, 1000, 2000],
      }}
      numericalInputOptions={[]}
      dataType=""
      onDataTypeChange={noop}
      taskDisplayNames={{
        lcs: "Entrada de texto",
      }}
      taskSubtitles={{
        lcs: "Texto",
      }}
      taskDescriptions={{
        lcs: "Texto",
      }}
      taskIcons={{}}
      taskBadges={{
        lcs: "LCS",
      }}
      inputSizeHelp={{
        lcs: "",
      }}
      paramLimits={{
        lcs: {
          inputSize: {
            min: 100,
            max: 1000,
            step: 100,
            recommendedMax: 750,
            defaultValue: 500,
            operationalTimeoutSeconds: 960,
          },
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

describe(
  "TestTypeAndParamsCard measurement policy",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "uses hard max for acceptance and recommended max for advisory",
      () => {
        const { container } =
          renderPolicyCard(1000);

        const numericInput =
          screen.getByRole("spinbutton");

        expect(numericInput).toHaveAttribute(
          "min",
          "100"
        );
        expect(numericInput).toHaveAttribute(
          "max",
          "1000"
        );

        const slider =
          container.querySelector(".param-range");

        expect(slider).toHaveAttribute(
          "min",
          "100"
        );
        expect(slider).toHaveAttribute(
          "max",
          "1000"
        );
        expect(slider).toHaveAttribute(
          "step",
          "100"
        );

        expect(
          screen.getByRole("status")
        ).toHaveTextContent("750");

        expect(
          screen.getByRole("button", {
            name: "500",
          })
        ).toBeInTheDocument();

        expect(
          screen.getByRole("button", {
            name: "750",
          })
        ).toBeInTheDocument();

        // Está sobre recommendedMax=750, pero el bloque
        // es de valores sugeridos y 1000 sigue dentro
        // de hardMax=1000.
        expect(
          screen.getByRole("button", {
            name: "1000",
          })
        ).toBeInTheDocument();

        // También queda fuera del hardMax.
        expect(
          screen.queryByRole("button", {
            name: "2000",
          })
        ).not.toBeInTheDocument();
      }
    );

    test(
      "does not warn at the recommended boundary",
      () => {
        renderPolicyCard(750);

        expect(
          screen.queryByRole("status")
        ).not.toBeInTheDocument();
      }
    );
  }
);
