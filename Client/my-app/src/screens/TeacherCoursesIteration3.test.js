import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";

import {
  I18nProvider,
} from "../i18n";

import TeacherCourses
  from "./TeacherCourses";

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


const renderPage = (
  currentUser
) =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <MemoryRouter>
        <TeacherCourses
          currentUser={currentUser}
        />
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "TeacherCourses Iteration 3 contracts",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      "Admin selects an active Teacher/Admin and sends the technical responsible ID",
      async () => {
        teacherApi.mockImplementation(
          (url, options = {}) => {
            if (
              String(url).includes(
                "/api/admin/users?"
              )
            ) {
              const teacherRequest =
                String(url).includes(
                  "role=Teacher"
                );

              return Promise.resolve({
                items: [
                  teacherRequest
                    ? {
                        id: 44,
                        name:
                          "Grace Hopper",
                        email:
                          "grace@example.com",
                        role: "Teacher",
                        isActive: true,
                      }
                    : {
                        id: 2,
                        name:
                          "Current Admin",
                        email:
                          "admin@example.com",
                        role: "Admin",
                        isActive: true,
                      },
                ],
              });
            }

            if (
              url
              === "/api/teacher/courses"
              && options.method
                === "POST"
            ) {
              return Promise.resolve({
                course: {},
              });
            }

            return Promise.resolve({
              items: [],
            });
          }
        );

        renderPage({
          id: 2,
          role_name: "Admin",
        });

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Create course" }
          )
        );

        const responsible =
          await screen.findByLabelText(
            "Responsible instructor"
          );

        expect(
          within(responsible).getByRole(
            "option",
            {
              name:
                "Grace Hopper — grace@example.com",
            }
          )
        ).toBeInTheDocument();

        fireEvent.change(
          responsible,
          {
            target: {
              value: "44",
            },
          }
        );
        fireEvent.change(
          screen.getByLabelText(
            "Code"
          ),
          {
            target: {
              value: "INF-221",
            },
          }
        );
        fireEvent.change(
          screen.getByLabelText(
            "Name"
          ),
          {
            target: {
              value:
                "Data Structures",
            },
          }
        );

        fireEvent.submit(
          screen
            .getByLabelText("Code")
            .closest("form")
        );

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            "/api/teacher/courses",
            expect.objectContaining({
              method: "POST",
              body:
                JSON.stringify({
                  code: "INF-221",
                  name:
                    "Data Structures",
                  academicYear:
                    new Date()
                      .getFullYear(),
                  academicTerm: 2,
                  teacherUserId: 44,
                }),
            })
          )
        );
      }
    );


    test(
      "Teacher keeps self-service creation without a responsible selector or payload override",
      async () => {
        teacherApi.mockImplementation(
          (url, options = {}) => {
            if (
              url
              === "/api/teacher/courses"
              && options.method
                === "POST"
            ) {
              return Promise.resolve({
                course: {},
              });
            }

            return Promise.resolve({
              items: [],
            });
          }
        );

        renderPage({
          id: 8,
          role_name: "Teacher",
        });

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Create course" }
          )
        );

        expect(
          screen.queryByLabelText(
            "Responsible instructor"
          )
        ).not.toBeInTheDocument();

        fireEvent.change(
          screen.getByLabelText("Code"),
          {
            target: {
              value: "INF-101",
            },
          }
        );
        fireEvent.change(
          screen.getByLabelText("Name"),
          {
            target: {
              value: "Algorithms",
            },
          }
        );
        fireEvent.submit(
          screen
            .getByLabelText("Code")
            .closest("form")
        );

        await waitFor(() => {
          const createCall =
            teacherApi.mock.calls.find(
              ([url, options]) =>
                url
                  === "/api/teacher/courses"
                && options?.method
                  === "POST"
            );
          const payload =
            JSON.parse(
              createCall[1].body
            );

          expect(payload).not
            .toHaveProperty(
              "teacherUserId"
            );
        });
      }
    );


    test(
      "active summary counts repeated enrolment once",
      async () => {
        teacherApi.mockResolvedValue({
          items: [
            {
              id: 10,
              code: "INF-101",
              name: "Algorithms",
              academicYear: 2026,
              academicTerm: 1,
              isActive: true,
              teacher: {
                fullName: "Alan Turing",
              },
              activeStudents: 1,
              totalStudents: 1,
              submissions: 2,
              executions: 3,
            },
            {
              id: 11,
              code: "INF-102",
              name: "Data Structures",
              academicYear: 2026,
              academicTerm: 1,
              isActive: true,
              teacher: {
                fullName: "Alan Turing",
              },
              activeStudents: 1,
              totalStudents: 1,
              submissions: 1,
              executions: 2,
            },
          ],
          total: 2,
          summary: {
            activeStudents: 1,
            totalStudents: 1,
          },
        });

        renderPage({
          id: 8,
          role_name: "Teacher",
        });

        const activeLabel =
          await screen.findByText(
            "Active students"
          );

        await waitFor(() => {
          expect(
            within(
              activeLabel.closest("article")
            ).getByText("1")
          ).toBeInTheDocument();
        });
      }
    );


    test(
      "historical courses use registered totals in the summary and card",
      async () => {
        teacherApi.mockImplementation(
          (url) =>
            Promise.resolve({
              items:
                String(url).includes(
                  "active=false"
                )
                  ? [
                      {
                        id: 12,
                        code: "INF-101",
                        name:
                          "Algorithms",
                        academicYear: 2025,
                        academicTerm: 2,
                        isActive: false,
                        teacher: {
                          fullName:
                            "Alan Turing",
                        },
                        activeStudents: 1,
                        totalStudents: 7,
                      },
                    ]
                  : [],
            })
        );

        renderPage({
          id: 8,
          role_name: "Teacher",
        });

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Historical" }
          )
        );

        const registeredLabel =
          await screen.findByText(
            "Registered students"
          );

        await screen.findByText(
          "7 registered students"
        );

        expect(
          within(
            registeredLabel.closest(
              "article"
            )
          ).getByText("7")
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "7 registered students"
          )
        ).toBeInTheDocument();
      }
    );
  }
);
