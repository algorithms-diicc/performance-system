import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import NotificationsMenu from "./NotificationsMenu";


jest.mock("../i18n", () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));


const jsonResponse = (payload, ok = true) =>
  Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(payload),
  });


describe("NotificationsMenu", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("loads unread notifications and opens the related experiment", async () => {
    global.fetch
      .mockImplementationOnce(() =>
        jsonResponse({
          unreadCount: 1,
          items: [
            {
              id: 12,
              kind: "TEACHER_FEEDBACK",
              isRead: false,
              actor: {
                fullName: "Ada Teacher",
              },
              submission: {
                id: 5,
                title: "LCS base",
              },
              feedback: {
                id: 8,
                preview: "Revisa la variabilidad.",
              },
            },
          ],
        })
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          notification: {
            id: 12,
            isRead: true,
          },
        })
      );

    render(
      <MemoryRouter>
        <NotificationsMenu />
        <Routes>
          <Route
            path="/submissions/5"
            element={<div>Experiment target</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(
          "notifications.unreadCount"
        )
      ).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "notifications.open",
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /notifications.kinds.teacherFeedback.title/i,
      })
    );

    expect(
      await screen.findByText("Experiment target")
    ).toBeInTheDocument();

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "api/notifications/12/read"
      ),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });

  test("marks all current notifications as read", async () => {
    global.fetch
      .mockImplementationOnce(() =>
        jsonResponse({
          unreadCount: 2,
          items: [
            {
              id: 1,
              kind: "EXECUTION_FAILED",
              isRead: false,
              submission: {
                id: 7,
                title: "SIZE",
              },
              execution: {
                id: 3,
                errorCode: "TIMEOUT",
              },
            },
            {
              id: 2,
              kind: "PROTOCOL_PUBLISHED",
              isRead: false,
              protocol: {
                id: 9,
                title: "CAMM laboratorio",
                course: {
                  id: 10,
                  code: "INF-221",
                },
              },
            },
          ],
        })
      )
      .mockImplementationOnce(() =>
        jsonResponse({ updated: 2 })
      );

    render(
      <MemoryRouter>
        <NotificationsMenu />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByLabelText(
          "notifications.unreadCount"
        )
      ).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "notifications.open",
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /notifications.readAll/i,
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByLabelText(
          "notifications.unreadCount"
        )
      ).not.toBeInTheDocument()
    );

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        "api/notifications/read-all"
      ),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      })
    );
  });
});
