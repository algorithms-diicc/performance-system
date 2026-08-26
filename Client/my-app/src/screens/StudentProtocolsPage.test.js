import React from "react";

import {
  render,
  screen,
} from "@testing-library/react";

import {
  MemoryRouter,
} from "react-router-dom";

import axios from "axios";

import StudentProtocolsPage
  from "./StudentProtocolsPage";


jest.mock("axios");

jest.mock("../i18n", () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));


describe("StudentProtocolsPage", () => {
  beforeEach(() => {
    axios.get.mockReset();
  });


  test("renders only the protocols returned by the student endpoint and prepares analysis", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 7,
            title: "LCS laboratorio",
            objective:
              "Comparar variantes.",
            instructions:
              "Adjunta tu ZIP.",
            benchmark: "LCS",
            inputSize: 1000,
            executionProfile:
              "rapido",
            samples: 10,
            dataType: null,
            course: {
              id: 4,
              code: "INF-221",
              academicYear: 2026,
              academicTerm: 2,
            },
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <StudentProtocolsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(
        "LCS laboratorio"
      )
    ).toBeInTheDocument();

    const prepare =
      screen.getByRole(
        "link",
        {
          name:
            "protocols.student.prepareAnalysis",
        }
      );

    expect(
      prepare
    ).toHaveAttribute(
      "href",
      "/?protocol=7"
    );
  });


  test("shows an empty state without inventing protocols", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [],
      },
    });

    render(
      <MemoryRouter>
        <StudentProtocolsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(
        "protocols.student.emptyTitle"
      )
    ).toBeInTheDocument();
  });
});
