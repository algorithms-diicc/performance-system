import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import ConfirmActionModal from "./ConfirmActionModal";

const defaultProps = {
  open: true,
  title: "Confirm action",
  description: "This change has an immediate effect.",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
};

const renderModal = (overrides = {}) =>
  render(
    <ConfirmActionModal
      {...defaultProps}
      {...overrides}
    />
  );

describe("ConfirmActionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders an accessible dialog and dispatches its actions", async () => {
    renderModal();

    const dialog = screen.getByRole("dialog", {
      name: "Confirm action",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent(
      "This change has an immediate effect."
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toHaveFocus()
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" })
    );
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Cancel" })
    );
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  test("closes with Escape and with the backdrop when enabled", () => {
    const { container } = renderModal();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(
      container.querySelector(
        ".confirm-action-modal__backdrop"
      )
    );
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(2);
  });

  test("keeps backdrop clicks inert when backdrop closing is disabled", () => {
    const { container } = renderModal({
      closeOnBackdrop: false,
    });

    fireEvent.mouseDown(
      container.querySelector(
        ".confirm-action-modal__backdrop"
      )
    );
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  test("traps Tab and Shift+Tab inside the dialog", async () => {
    renderModal();

    const cancelButton = screen.getByRole("button", {
      name: "Cancel",
    });
    const confirmButton = screen.getByRole("button", {
      name: "Confirm",
    });

    await waitFor(() =>
      expect(cancelButton).toHaveFocus()
    );

    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancelButton).toHaveFocus();

    cancelButton.focus();
    fireEvent.keyDown(document, {
      key: "Tab",
      shiftKey: true,
    });
    expect(confirmButton).toHaveFocus();
  });

  test("blocks every close path while loading", () => {
    const { container } = renderModal({
      loading: true,
      variant: "danger",
      body: <p>Dangerous operation</p>,
    });

    const dialog = screen.getByRole("dialog", {
      name: "Confirm action",
    });
    const cancelButton = screen.getByRole("button", {
      name: "Cancel",
    });
    const confirmButton = screen.getByRole("button", {
      name: "Confirm",
    });

    expect(dialog).toHaveAttribute("aria-busy", "true");
    expect(dialog).toHaveClass("confirm-action-modal--danger");
    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText("Dangerous operation")).toBeInTheDocument();

    fireEvent.click(confirmButton);
    fireEvent.click(cancelButton);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(
      container.querySelector(
        ".confirm-action-modal__backdrop"
      )
    );

    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    expect(defaultProps.onCancel).not.toHaveBeenCalled();
  });

  test("restores focus to the opener after closing", async () => {
    const opener = document.createElement("button");
    opener.textContent = "Open modal";
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <ConfirmActionModal {...defaultProps} />
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toHaveFocus()
    );

    rerender(
      <ConfirmActionModal
        {...defaultProps}
        open={false}
      />
    );

    await waitFor(() =>
      expect(opener).toHaveFocus()
    );

    opener.remove();
  });

  test("does not reset focus when onCancel identity changes", async () => {
    const firstCancel = jest.fn();
    const { rerender } = renderModal({
      onCancel: firstCancel,
    });

    const confirmButton = screen.getByRole("button", {
      name: "Confirm",
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toHaveFocus()
    );

    confirmButton.focus();
    const nextCancel = jest.fn();

    rerender(
      <ConfirmActionModal
        {...defaultProps}
        onCancel={nextCancel}
      />
    );

    expect(confirmButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(firstCancel).not.toHaveBeenCalled();
    expect(nextCancel).toHaveBeenCalledTimes(1);
  });

  test("does not render when closed", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
