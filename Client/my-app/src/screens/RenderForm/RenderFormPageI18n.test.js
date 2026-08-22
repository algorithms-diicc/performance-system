import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import { I18nProvider, useI18n } from "../../i18n";
import RenderFormPage from "./RenderFormPage";

jest.mock("axios");

jest.mock("./hooks/useExecutionPolling", () => () => ({
  messages: [],
  executionFiles: [],
  allDone: false,
  allTerminal: false,
  hasError: false,
  firstErrorMessage: "",
  requestError: "",
  retryPolling: jest.fn(),
}));

const currentUser = {
  id: 7,
  email: "student@inf.udec.cl",
  role_name: "Student",
};

const emptyCourses = {
  data: {
    items: [],
    selectionRequired: false,
  },
};

function LanguageControl() {
  const { setLanguage } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLanguage("es")}
    >
      switch-es
    </button>
  );
}

const renderEnglishPage = async (
  route = "/new-analysis"
) => {
  const view = render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <MemoryRouter initialEntries={[route]}>
        <RenderFormPage currentUser={currentUser} />
      </MemoryRouter>
    </I18nProvider>
  );

  await act(async () => {
    await Promise.resolve();
  });

  return view;
};

describe("RenderFormPage i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.alert = jest.fn();

    axios.get.mockResolvedValue(emptyCourses);
  });

  test("localizes inline pre-submit requirements without browser dialogs", async () => {
    await renderEnglishPage();

    expect(
      screen.getByRole("heading", {
        name: "New performance analysis",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Prepare your experiment",
      })
    ).toBeInTheDocument();

    fireEvent.submit(
      document.querySelector("form")
    );

    expect(
      screen.getByText("Select a ZIP archive.")
    ).toBeInTheDocument();
    expect(screen.getByText("Choose a benchmark.")).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });

  test("keeps parameter validation reactive when language changes", async () => {
    await renderEnglishPage();

    fireEvent.click(
      screen.getByText("Numeric data")
    );

    const numericInputs =
      screen.getAllByRole("spinbutton");

    fireEvent.change(numericInputs[0], {
      target: { value: "" },
    });

    expect(
      screen.getByText("Enter a numeric value.")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      screen.getByText("Ingresa un valor numérico.")
    ).toBeInTheDocument();
  });

  test("localizes a persistent-execution 404 without leaking the Spanish source message", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("api/student/courses")) {
        return Promise.resolve(emptyCourses);
      }

      if (url.includes("api/executions/")) {
        return Promise.reject({
          response: { status: 404 },
        });
      }

      return Promise.reject(
        new Error(`Unexpected GET ${url}`)
      );
    });

    await renderEnglishPage(
      "/new-analysis?execution=missing-execution"
    );

    expect(
      await screen.findByText(
        "The execution specified in the URL no longer exists."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "La ejecución indicada en la URL ya no existe."
      )
    ).not.toBeInTheDocument();
  });
});
