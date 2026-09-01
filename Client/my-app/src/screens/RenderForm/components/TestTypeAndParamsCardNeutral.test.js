import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";

import TestTypeAndParamsCard from "./TestTypeAndParamsCard";

test("no benchmark shows a neutral policy state without operational limits", () => {
  render(
    <TestTypeAndParamsCard
      tasks={[]}
      selectedTaskType=""
      onTaskChange={jest.fn()}
      inputSize=""
      samples={30}
      onInputSizeChange={jest.fn()}
      onInputSizeSliderChange={jest.fn()}
      onSamplesChange={jest.fn()}
      onSamplesSliderChange={jest.fn()}
      paramErrors={{}}
      inputSizePresets={{}}
      numericalInputOptions={[]}
      dataType=""
      onDataTypeChange={jest.fn()}
      taskDisplayNames={{}}
      taskSubtitles={{}}
      taskDescriptions={{}}
      taskIcons={{}}
      taskBadges={{}}
      inputSizeHelp={{}}
      paramLimits={{}}
      executionProfile="equilibrado"
    />
  );

  expect(
    screen.getByRole("status")
  ).toHaveTextContent(
    /Selecciona un benchmark para cargar los límites/i
  );

  expect(
    screen.queryByText("Política operacional efectiva")
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Mínimo")
  ).not.toBeInTheDocument();

  expect(
    screen.queryByText("Máximo absoluto")
  ).not.toBeInTheDocument();
});
