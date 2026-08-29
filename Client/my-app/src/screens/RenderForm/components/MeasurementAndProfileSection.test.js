import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import MeasurementAndProfileSection from "./MeasurementAndProfileSection";

const profiles = [
  {
    id: "rapido",
    name: "Rápido",
    badge: "Exploración",
    samples: 10,
    description: "Quick",
  },
  {
    id: "equilibrado",
    name: "Equilibrado",
    badge: "Recomendado",
    samples: 30,
    description: "Balanced",
  },
  {
    id: "exhaustivo",
    name: "Exhaustivo",
    badge: "Mayor estabilidad",
    samples: 50,
    description: "Exhaustive",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    badge: "Control manual",
    samples: null,
    description: "Custom",
  },
];

const nodes = [
  {
    nodeKey: "shenu",
    displayName: "Shenu",
    state: "AVAILABLE",
    validationOnly: false,
    hardwareProfile: {
      profileKey:
        "shenu-intel-i5-9400",
      name: "Shenu Intel i5-9400",
    },
  },
  {
    nodeKey: "ryzen-validation",
    displayName: "Ryzen validation",
    state: "AVAILABLE",
    validationOnly: true,
    hardwareProfile: {
      profileKey:
        "ryzen-amd-ryzen-5-3600",
      name: "Ryzen 5 3600",
    },
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
  onMeasurementNodeModeChange:
    jest.fn(),
  onMeasurementNodeChange:
    jest.fn(),
  onRetryMeasurementNodes:
    jest.fn(),
};

describe(
  "MeasurementAndProfileSection targeting",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "AUTO is default and describes serial multi-node execution",
      () => {
        render(
          <MeasurementAndProfileSection
            {...baseProps}
          />
        );

        expect(
          screen.getByRole(
            "radiogroup",
            {
              name:
                "Modo de selección del nodo de medición",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "radiogroup",
            {
              name:
                "Perfil de medición",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "radio",
            {
              name:
                "Usar selección automática de nodo",
            }
          )
        ).toBeChecked();

        expect(
          screen.getByText(
            /pool multinodo de ejecución serial/i
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /una única medición física activa/i
          )
        ).toBeInTheDocument();
      }
    );

    test(
      "PINNED is advanced and requests the mode explicitly",
      () => {
        const onModeChange =
          jest.fn();

        render(
          <MeasurementAndProfileSection
            {...baseProps}
            onMeasurementNodeModeChange={
              onModeChange
            }
          />
        );

        fireEvent.click(
          screen.getByRole(
            "radio",
            {
              name:
                "Fijar un nodo de medición",
            }
          )
        );

        expect(
          onModeChange
        ).toHaveBeenCalledWith(
          "PINNED"
        );

        expect(
          screen.getByText("Avanzado")
        ).toBeInTheDocument();
      }
    );

    test(
      "PINNED renders the sanitized node contract received from the backend",
      () => {
        const onNodeChange =
          jest.fn();

        render(
          <MeasurementAndProfileSection
            {...baseProps}
            measurementNodeMode="PINNED"
            measurementNodes={nodes}
            selectedMeasurementNodeKey="shenu"
            onMeasurementNodeChange={
              onNodeChange
            }
          />
        );

        const select =
          screen.getByRole(
            "combobox",
            {
              name:
                "Nodo de medición",
            }
          );

        expect(select).toHaveValue(
          "shenu"
        );

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Shenu · Shenu Intel i5-9400",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "option",
            {
              name:
                "Ryzen validation · Ryzen 5 3600 · Validación",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Perfil de hardware: Shenu Intel i5-9400"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /no migra silenciosamente/i
          )
        ).toBeInTheDocument();

        fireEvent.change(
          select,
          {
            target: {
              value:
                "ryzen-validation",
            },
          }
        );

        expect(
          onNodeChange
        ).toHaveBeenCalledWith(
          "ryzen-validation"
        );
      }
    );

    test(
      "PINNED empty state keeps AUTO available as recovery",
      () => {
        render(
          <MeasurementAndProfileSection
            {...baseProps}
            measurementNodeMode="PINNED"
            measurementNodes={[]}
          />
        );

        expect(
          screen.getByText(
            /No hay nodos disponibles/i
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "radio",
            {
              name:
                "Usar selección automática de nodo",
            }
          )
        ).toBeInTheDocument();
      }
    );
  }
);
