import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import { I18nProvider, useI18n } from "../i18n";
import AcademicBreadcrumbs from "./AcademicBreadcrumbs";
import SourceViewerModal from "./SourceViewerModal";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const student = { role_name: "Student" };
const teacher = { role_name: "Teacher" };

const course = {
  id: 9,
  code: "CC4102",
  name: "Diseño y Análisis de Algoritmos",
};

const LanguageControl = () => {
  const { setLanguage } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLanguage("es")}
    >
      switch-es
    </button>
  );
};

describe("Submission navigation primitives i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("localizes Student breadcrumbs while preserving course data", () => {
    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter>
          <AcademicBreadcrumbs
            currentUser={student}
            page="submission"
            submissionId={7}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    const navigation = screen.getByRole(
      "navigation",
      { name: "Breadcrumb" }
    );

    expect(
      within(navigation).getByRole("link", {
        name: "My profile",
      })
    ).toHaveAttribute("href", "/profile");

    expect(
      within(navigation).getByText(
        "Experiment #7"
      )
    ).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("Teacher breadcrumbs keep institutional course names untouched", () => {
    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter>
          <AcademicBreadcrumbs
            currentUser={teacher}
            page="submission"
            submissionId={7}
            course={course}
            courseId={9}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    const navigation = screen.getByRole(
      "navigation",
      { name: "Breadcrumb" }
    );

    expect(
      within(navigation).getByRole("link", {
        name: "Supervision",
      })
    ).toHaveAttribute(
      "href",
      "/teacher/courses"
    );

    expect(
      within(navigation).getByRole("link", {
        name:
          "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toBeInTheDocument();
  });

  test("source viewer error text reacts to language changes without refetching", async () => {
    const suppliedTrace = {
      permissions: {
        canViewSource: true,
        canDownloadSource: false,
      },
      execution: {
        source: {
          filename: "solucion.cpp",
          available: false,
        },
      },
    };

    render(
      <I18nProvider initialLanguage="en">
        <LanguageControl />
        <SourceViewerModal
          open
          codename="exec-1"
          trace={suppliedTrace}
          onClose={() => {}}
        />
      </I18nProvider>
    );

    expect(
      await screen.findByText(
        "The historical source is not available for this execution."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Close code viewer",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByText(
        "La fuente histórica no está disponible para esta ejecución."
      )
    ).toBeInTheDocument();

    expect(axios.get).not.toHaveBeenCalled();
  });

  test("ready source viewer localizes chrome but preserves code and filename", async () => {
    axios.get.mockResolvedValue({
      data: {
        source: {
          filename: "solucion.cpp",
          content: "int main() { return 0; }",
          sizeBytes: 1536,
          sha256: "a".repeat(64),
        },
      },
    });

    const suppliedTrace = {
      permissions: {
        canViewSource: true,
        canDownloadSource: true,
      },
      execution: {
        source: {
          filename: "solucion.cpp",
          available: true,
        },
      },
    };

    render(
      <I18nProvider initialLanguage="en">
        <SourceViewerModal
          open
          codename="exec-1"
          trace={suppliedTrace}
          onClose={() => {}}
        />
      </I18nProvider>
    );

    expect(
      await screen.findByRole("heading", {
        name: "solucion.cpp",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Source for this execution"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Read-only historical view"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("1.5 KB")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "int main() { return 0; }"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Download source/i,
      })
    ).toBeInTheDocument();
  });
});
