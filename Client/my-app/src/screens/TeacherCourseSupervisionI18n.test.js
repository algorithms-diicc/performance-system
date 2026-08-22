import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";

import {
  I18nProvider,
  useI18n,
} from "../i18n";

import TeacherCourseAnalytics
  from "./TeacherCourseAnalytics";

import TeacherCourseAttention
  from "./TeacherCourseAttention";

import {
  teacherApi,
} from "./teacherApi";


jest.mock(
  "./teacherApi",
  () => {
    const actual =
      jest.requireActual(
        "./teacherApi"
      );

    return {
      ...actual,
      teacherApi:
        jest.fn(),
    };
  }
);


const plotProps = [];

jest.mock(
  "react-plotly.js",
  () => (props) => {
    plotProps.push(props);
    return (
      <div data-testid="teacher-plot" />
    );
  }
);


const LanguageControl = () => {
  const {
    setLanguage,
  } = useI18n();

  return (
    <button
      type="button"
      onClick={() =>
        setLanguage("es")
      }
    >
      switch-es
    </button>
  );
};


const analyticsPayload = {
  kpis: {
    activeStudents: 2,
    submissions: 4,
    executions: 7,
    completionRate: 83.3,
  },
  participation: [
    {
      key: "zero",
      label: "0 ejecuciones",
      students: 1,
    },
    {
      key: "oneToFour",
      label: "1–4",
      students: 1,
    },
  ],
  benchmarks: [
    {
      key: "LCS",
      label: "LCS",
      executions: 7,
    },
  ],
  activity: {
    startDate: "2026-08-01",
    endDate: "2026-08-20",
    items: [
      {
        date: "2026-08-20",
        executions: 7,
      },
    ],
  },
};


const students = [
  {
    userId: 3,
    fullName: "Ada Lovelace",
    lastActivityAt:
      "2026-08-20T12:00:00Z",
    lastResultCodename:
      "exec70LCS",
    attention: {
      noExecutions: true,
      failedMoreThanCompleted:
        false,
    },
  },
  {
    userId: 4,
    fullName: "Grace Hopper",
    lastActivityAt:
      "2026-08-19T12:00:00Z",
    attention: {
      noExecutions: false,
      failedMoreThanCompleted:
        true,
    },
  },
];


const renderAnalyticsEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />
      <TeacherCourseAnalytics
        courseId="10"
        reloadToken={0}
      />
    </I18nProvider>
  );


const renderAttentionEnglish = (
  props = {}
) =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />
      <MemoryRouter>
        <TeacherCourseAttention
          courseId="10"
          students={students}
          loading={false}
          error={null}
          onRetry={jest.fn()}
          onSelectFilter={jest.fn()}
          {...props}
        />
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "Teacher course supervision i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      plotProps.length = 0;
    });


    test(
      "localizes analytics and Plotly chrome without refetching on language change",
      async () => {
        teacherApi
          .mockResolvedValue(
            analyticsPayload
          );

        renderAnalyticsEnglish();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Course analytics",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Aggregate monitoring"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Completed executions rate"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText("83.3")
        ).toBeInTheDocument();

        await waitFor(() =>
          expect(
            plotProps.length
          ).toBeGreaterThanOrEqual(3)
        );

        expect(
          plotProps[0]
            .layout
            .yaxis
            .title
            .text
        ).toBe("Students");

        expect(
          plotProps[0]
            .data[0]
            .x
        ).toEqual([
          "0 executions",
          "1–4",
        ]);

        expect(
          plotProps[0]
            .data[0]
            .hovertemplate
        ).toContain("students");

        expect(
          plotProps[1]
            .data[0]
            .labels
        ).toEqual(["LCS"]);

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Analítica del curso",
            }
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Tasa de ejecuciones completadas"
          )
        ).toBeInTheDocument();

        await waitFor(() =>
          expect(
            plotProps[
              plotProps.length - 3
            ]
              .layout
              .yaxis
              .title
              .text
          ).toBe("Estudiantes")
        );

        expect(
          plotProps[
            plotProps.length - 3
          ]
            .data[0]
            .x
        ).toEqual([
          "0 ejecuciones",
          "1–4",
        ]);

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);
      }
    );


    test(
      "reactively localizes an analytics error without retrying the request",
      async () => {
        teacherApi
          .mockRejectedValue({
            status: 500,
            code:
              "INTERNAL_ERROR",
            message:
              "Error interno del servidor.",
          });

        renderAnalyticsEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          await screen.findByText(
            "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);
      }
    );


    test(
      "localizes academic-attention chrome while preserving student data and filter semantics",
      async () => {
        const onSelectFilter =
          jest.fn();

        renderAttentionEnglish({
          onSelectFilter,
        });

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Academic attention",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Ada Lovelace"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "link",
            {
              name:
                "View latest result for Ada Lovelace",
            }
          )
        ).toHaveAttribute(
          "href",
          "/code/exec70LCS"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "1 student with no executions. View students.",
            }
          )
        );

        expect(
          onSelectFilter
        ).toHaveBeenCalledWith(
          "no-executions"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Atención académica",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Ada Lovelace"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "localizes structured attention errors",
      () => {
        renderAttentionEnglish({
          students: [],
          error: {
            status: 403,
            code: "FORBIDDEN",
            message:
              "Tu cuenta no tiene permisos.",
          },
        });

        expect(
          screen.getByText(
            "Could not load academic attention"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Your account does not have permission to perform this action."
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Tu cuenta no tiene permisos."
          )
        ).not.toBeInTheDocument();
      }
    );
  }
);
