import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import MeasurementAndProfileSection from "./MeasurementAndProfileSection";

const profiles = [
  {
    id: "equilibrado",
    name: "Equilibrado",
    badge: "Recomendado",
    samples: 30,
    description: "Perfil",
  },
];

const baseProps = {
  executionProfiles: profiles,
  executionProfile: "equilibrado",
  onExecutionProfileChange: jest.fn(),
  measurementNodeMode: "AUTO",
  measurementNodes: [],
  measurementNodesLoading: false,
  measurementNodesError: false,
  selectedMeasurementNodeKey: "",
  onMeasurementNodeModeChange: jest.fn(),
  onMeasurementNodeChange: jest.fn(),
  onRetryMeasurementNodes: jest.fn(),
  onRetryMeasurementAvailability: jest.fn(),
};

describe("MeasurementAndProfileSection availability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows unavailable AUTO state and retries", () => {
    const retry = jest.fn();

    render(
      <MeasurementAndProfileSection
        {...baseProps}
        measurementAvailability="UNAVAILABLE"
        onRetryMeasurementAvailability={retry}
      />
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      /No hay un nodo de medición operativo/i
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reintentar disponibilidad",
      })
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  test("shows that AUTO can accept new work when a node is live", () => {
    render(
      <MeasurementAndProfileSection
        {...baseProps}
        measurementAvailability="AVAILABLE"
      />
    );

    expect(
      screen.getByRole("status")
    ).toHaveTextContent(
      /Entorno de medición disponible/i
    );
  });
});
