import React, { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { I18nProvider } from "../../../i18n";
import HeaderSection from "./HeaderSection";
import MeasurementAndProfileSection from "./MeasurementAndProfileSection";
import TestNameAndUploadCard from "./TestNameAndUploadCard";

describe("RenderForm shell i18n", () => {
  test("localizes the header helper link in English", () => {
    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter>
          <HeaderSection
            title="Dynamic title"
            subtitle="Dynamic subtitle"
          />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByText("Performance experiment")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /Need an example\? View code examples/i,
      })
    ).toHaveAttribute("href", "/tutorial#ejemplos");
  });

  test("localizes upload labels, aria text and cpp pluralization", () => {
    render(
      <I18nProvider initialLanguage="en">
        <TestNameAndUploadCard
          testName=""
          onTestNameChange={() => {}}
          note="abc"
          onNoteChange={() => {}}
          fileMeta={{
            name: "code.zip",
            sizeLabel: "1 MB",
            sourceCount: 2,
            cCount: 1,
            cppCount: 1,
            sourceSample: ["a.c", "b.cpp"],
          }}
          fileError=""
          isDraggingFile={false}
          isInspectingZip={false}
          onDrop={() => {}}
          onDragOver={() => {}}
          onDragLeave={() => {}}
          onFileInputChange={() => {}}
          fileInputRef={createRef()}
          maxZipMb={10}
        />
      </I18nProvider>
    );

    expect(
      screen.getByLabelText("Test name")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Select ZIP code archive",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("3 / 500 characters")
    ).toBeInTheDocument();

    expect(
      screen.getByText(/2 sources · 1 C · 1 C\+\+/)
    ).toBeInTheDocument();

    expect(
      screen.getByText("Examples inside the .zip:")
    ).toBeInTheDocument();
  });

  test("localizes managed environment and known execution profiles", () => {
    render(
      <I18nProvider initialLanguage="en">
        <MeasurementAndProfileSection
          executionEnvironment={{
            name: "Entorno de medición administrado",
            badge: "Automático",
            description: "Descripción en español",
            note: "Nota en español",
          }}
          executionProfiles={[
            {
              id: "equilibrado",
              name: "Equilibrado",
              badge: "Recomendado",
              samples: 30,
              description: "Descripción en español",
            },
          ]}
          executionProfile="equilibrado"
          onExecutionProfileChange={() => {}}
        />
      </I18nProvider>
    );

    expect(
      screen.getByText("Managed measurement environment")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Balanced")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Recommended")
    ).toBeInTheDocument();

    expect(
      screen.getByText("30 repetitions per point")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Equilibrado")
    ).not.toBeInTheDocument();
  });
});
