import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import axios from "axios";

import TeacherFeedbackPanel
  from "./TeacherFeedbackPanel";


jest.mock("axios");

jest.mock("../i18n", () => ({
  useI18n: () => ({
    locale: "es-CL",
    t: (key) => key,
  }),
}));


const STUDENT = {
  id: 3,
  role_name: "Student",
};

const TEACHER = {
  id: 20,
  role_name: "Teacher",
};


describe("TeacherFeedbackPanel", () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
  });

  test("student reads the timeline without a reply composer", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 8,
            submissionId: 5,
            message: "Revisa la variabilidad.",
            createdAt: null,
            author: {
              id: 20,
              fullName: "Profesor Ada",
              role: "Teacher",
            },
          },
        ],
      },
    });

    render(
      <TeacherFeedbackPanel
        currentUser={STUDENT}
        submissionId={5}
        courseId={10}
      />
    );

    expect(
      await screen.findByText(
        "Revisa la variabilidad."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  test("teacher can publish one feedback entry without reply semantics", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        items: [],
      },
    });

    axios.post.mockResolvedValueOnce({
      data: {
        feedback: {
          id: 9,
          submissionId: 5,
          message: "Compara también IPC.",
          createdAt: null,
          author: {
            id: 20,
            fullName: "Profesor Ada",
            role: "Teacher",
          },
        },
      },
    });

    render(
      <TeacherFeedbackPanel
        currentUser={TEACHER}
        submissionId={5}
        courseId={10}
      />
    );

    const textarea =
      await screen.findByRole("textbox");

    fireEvent.change(textarea, {
      target: {
        value: "  Compara también IPC.  ",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "teacherFeedback.actions.send",
      })
    );

    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining(
          "api/submissions/5/feedback"
        ),
        {
          message: "Compara también IPC.",
        },
        {
          withCredentials: true,
        }
      )
    );

    expect(
      await screen.findByText(
        "Compara también IPC."
      )
    ).toBeInTheDocument();
  });
});
