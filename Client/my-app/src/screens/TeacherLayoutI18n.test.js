import React from "react";

import {
  render,
  screen,
} from "@testing-library/react";

import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  I18nProvider,
} from "../i18n";

import TeacherLayout from "./TeacherLayout";


function renderLayout(language) {
  return render(
    <I18nProvider
      initialLanguage={language}
    >
      <MemoryRouter
        initialEntries={[
          "/teacher/courses",
        ]}
      >
        <Routes>
          <Route
            path="/teacher"
            element={<TeacherLayout />}
          >
            <Route
              path="courses"
              element={<div />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}


describe("TeacherLayout i18n", () => {
  test("renders supervision navigation in English", () => {
    renderLayout("en");

    expect(
      screen.getByRole(
        "navigation",
        {
          name:
            "Teacher supervision",
        }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        "link",
        {
          name: "Courses",
        }
      )
    ).toBeInTheDocument();
  });

  test("renders supervision navigation in Spanish", () => {
    renderLayout("es");

    expect(
      screen.getByRole(
        "navigation",
        {
          name:
            "Supervisión docente",
        }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        "link",
        {
          name: "Cursos",
        }
      )
    ).toBeInTheDocument();
  });
});
