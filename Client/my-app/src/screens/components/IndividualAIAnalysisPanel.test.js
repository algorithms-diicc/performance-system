import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  I18nProvider,
} from "../../i18n";
import IndividualAIAnalysisPanel from "./IndividualAIAnalysisPanel";


const mockExplanation = {
  schema_version: "1.0",
  provider: "mock",
  simulated: true,
  generated_by_ai: false,
  language: "es",
  model: "local-deterministic-mock-v1",
  cached: false,
  content: {
    summary:
      "Resumen simulado basado en evidencia determinística.",
    observations: [
      {
        metric: "DurationTime",
        evidence_kind: "snapshot",
        text:
          "La evidencia contiene un valor observado para tiempo.",
      },
    ],
    limitations: [
      "Existe una limitación experimental.",
    ],
    student_takeaway:
      "Conviene revisar la tendencia junto con la variabilidad.",
  },
};


function renderPanel(
  language = "es",
  props = {}
) {
  const onGenerate = jest.fn();

  render(
    <I18nProvider
      initialLanguage={language}
    >
      <main className="results-page">
        <IndividualAIAnalysisPanel
          explanation={null}
          loading={false}
          errorKey=""
          onGenerate={onGenerate}
          {...props}
        />
      </main>
    </I18nProvider>
  );

  return {
    onGenerate,
  };
}


describe(
  "IndividualAIAnalysisPanel",
  () => {
    test(
      "presents idle state and invokes generation",
      () => {
        const { onGenerate } =
          renderPanel("en");

        expect(
          screen.getByRole("heading", {
            name: "AI-assisted analysis",
          })
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /does not receive student source code or raw CSV data/i
          )
        ).toBeInTheDocument();

        fireEvent.click(
          screen.getByRole("button", {
            name: "Generate AI analysis",
          })
        );

        expect(
          onGenerate
        ).toHaveBeenCalledTimes(1);
      }
    );

    test(
      "identifies simulated development response and all pedagogical sections",
      () => {
        renderPanel(
          "es",
          {
            explanation:
              mockExplanation,
          }
        );

        expect(
          screen.getByRole("status")
        ).toHaveTextContent(
          "Respuesta simulada · modo desarrollo"
        );

        for (const heading of [
          "Resumen",
          "Patrones observados",
          "Qué conviene observar",
          "Limitaciones",
        ]) {
          expect(
            screen.getByRole("heading", {
              name: heading,
            })
          ).toBeInTheDocument();
        }

        expect(
          screen.getByText(
            mockExplanation.content.summary
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Tiempo de ejecución"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Valor observado"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Código fuente enviado: no/i
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /CSV bruto enviado: no/i
          )
        ).toBeInTheDocument();
      }
    );

    test(
      "presents real provider metadata in English",
      () => {
        renderPanel(
          "en",
          {
            explanation: {
              ...mockExplanation,
              provider: "openai",
              simulated: false,
              generated_by_ai: true,
              language: "en",
              model: "server-model",
              cached: true,
              content: {
                summary:
                  "Evidence-backed assistant summary.",
                observations: [],
                limitations: [],
                student_takeaway:
                  "Inspect the measured evidence.",
              },
            },
          }
        );

        expect(
          screen.getByRole("status")
        ).toHaveTextContent(
          "AI-generated response"
        );

        expect(
          screen.getByText(
            "Provider: OpenAI"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Reused from cache"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "No additional limitations were reported by the assistant."
          )
        ).toBeInTheDocument();
      }
    );

    test(
      "keeps previous individual analysis visible while regeneration is loading",
      () => {
        renderPanel(
          "es",
          {
            explanation: mockExplanation,
            loading: true,
          }
        );

        expect(
          document.querySelector(".individual-ai-panel")
        ).toHaveAttribute("aria-busy", "true");

        expect(
          document.querySelector(".individual-ai-loading")
        ).toBeInTheDocument();

        expect(
          document.querySelectorAll(".individual-ai-spinner").length
        ).toBeGreaterThanOrEqual(2);

        expect(
          screen.getByText(
            mockExplanation.content.summary
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole("button")
        ).toBeDisabled();
      }
    );

    test(
      "communicates provider timeout without invalidating measurements",
      () => {
        renderPanel(
          "es",
          {
            errorKey:
              "renderImageScientific.ai.errors.timeout",
          }
        );

        expect(
          screen.getByText(
            /las mediciones y los gráficos siguen disponibles/i
          )
        ).toBeInTheDocument();
      }
    );
  }
);
