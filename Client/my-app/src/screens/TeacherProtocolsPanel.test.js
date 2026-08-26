import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import TeacherProtocolsPanel from "./TeacherProtocolsPanel";
import { teacherApi } from "./teacherApi";

jest.mock("./teacherApi", () => ({
  teacherApi: jest.fn(),
  teacherRequestErrorMessage: () => "request error",
}));

jest.mock("../i18n", () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe("TeacherProtocolsPanel", () => {
  beforeEach(() => {
    teacherApi.mockReset();
  });

  test("loads protocols and exposes publish/deactivate actions", async () => {
    teacherApi.mockResolvedValueOnce({
      items: [{
        id: 8,
        title: "LCS baseline",
        objective: "Compare implementations",
        benchmark: "LCS",
        inputSize: 1000,
        samples: 10,
        dataType: null,
        executionProfile: "rapido",
        isPublished: false,
        isActive: true,
        state: "DRAFT",
      }],
    });

    render(
      <TeacherProtocolsPanel
        courseId="4"
        courseActive
      />
    );

    expect(
      await screen.findByText("LCS baseline")
    ).toBeInTheDocument();

    expect(teacherApi).toHaveBeenCalledWith(
      "/api/teacher/courses/4/protocols",
      expect.objectContaining({
        signal: expect.any(Object),
      })
    );

    expect(
      screen.getByRole("button", {
        name: "protocols.actions.publish",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "protocols.actions.deactivate",
      })
    ).toBeInTheDocument();
  });

  test("creates a draft using the visible experimental defaults", async () => {
    teacherApi
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ protocol: { id: 12 } })
      .mockResolvedValueOnce({ items: [] });

    render(
      <TeacherProtocolsPanel
        courseId="9"
        courseActive
      />
    );

    await screen.findByText("protocols.teacher.emptyTitle");

    fireEvent.click(
      screen.getByRole("button", {
        name: "protocols.actions.create",
      })
    );

    const titleLabel =
      screen.getByText("protocols.fields.title");
    const objectiveLabel =
      screen.getByText("protocols.fields.objective");

    fireEvent.change(
      titleLabel.parentElement.querySelector("input"),
      { target: { value: "Protocol LCS" } }
    );
    fireEvent.change(
      objectiveLabel.parentElement.querySelector("textarea"),
      { target: { value: "Measure scaling" } }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "protocols.actions.save",
      })
    );

    await waitFor(() => {
      expect(teacherApi).toHaveBeenCalledWith(
        "/api/teacher/courses/9/protocols",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    const postCall = teacherApi.mock.calls.find(
      ([, options]) => options?.method === "POST"
    );

    expect(JSON.parse(postCall[1].body)).toEqual({
      title: "Protocol LCS",
      objective: "Measure scaling",
      instructions: "",
      benchmark: "LCS",
      inputSize: 1000,
      executionProfile: "rapido",
      samples: 10,
      dataType: null,
    });
  });

  test("inactive protocol can be republished when the course is active", async () => {
    teacherApi
      .mockResolvedValueOnce({
        items: [{
          id: 15,
          title: "Protocol inactive",
          objective: "Reuse configuration",
          benchmark: "SIZE",
          inputSize: 2500,
          samples: 10,
          dataType: null,
          executionProfile: "rapido",
          isPublished: false,
          isActive: false,
          state: "INACTIVE",
        }],
      })
      .mockResolvedValueOnce({
        protocol: {
          id: 15,
          isPublished: true,
          isActive: true,
        },
      })
      .mockResolvedValueOnce({
        items: [],
      });

    render(
      <TeacherProtocolsPanel
        courseId="6"
        courseActive
      />
    );

    expect(
      await screen.findByText(
        "Protocol inactive"
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            "protocols.actions.publish",
        }
      )
    );

    await waitFor(() => {
      expect(
        teacherApi
      ).toHaveBeenCalledWith(
        "/api/teacher/courses/6/protocols/15/publish",
        {
          method: "POST",
        }
      );
    });
  });

  test("inactive course disables protocol creation", async () => {
    teacherApi.mockResolvedValueOnce({ items: [] });

    render(
      <TeacherProtocolsPanel
        courseId="5"
        courseActive={false}
      />
    );

    await screen.findByText("protocols.teacher.emptyTitle");

    expect(
      screen.getByRole("button", {
        name: "protocols.actions.create",
      })
    ).toBeDisabled();
  });
});
