import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axios from "axios";

import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import SourceViewerModal from "./SourceViewerModal";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const SHA = "a".repeat(64);
const trace = {
  execution: {
    codename: "exec70LCS",
    source: {
      filename: "nested/source.cpp",
      available: true,
      sha256: SHA,
      sizeBytes: 31,
    },
  },
  permissions: {
    canViewSource: true,
    canDownloadSource: true,
  },
};
const source = {
  filename: "nested/source.cpp",
  content: "int main() {\n  return 0;\n}\n",
  sizeBytes: 31,
  sha256: SHA,
};

describe("SourceViewerModal", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (String(url).endsWith("/trace")) {
        return Promise.resolve({ data: trace });
      }
      return Promise.resolve({ data: { source } });
    });
  });

  test("loads trace then renders exact read-only source metadata and content", async () => {
    const { container } = render(
      <SourceViewerModal
        open
        codename="exec70LCS"
        onClose={onClose}
      />
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("int main() {", { exact: false })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "nested/source.cpp" })
    ).toBeInTheDocument();
    expect(screen.getByTitle(SHA)).toHaveTextContent(
      `${"a".repeat(12)}…${"a".repeat(8)}`
    );
    expect(screen.getByText("31 B")).toBeInTheDocument();
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("pre code")).toHaveTextContent(
      "int main() { return 0; }"
    );
    expect(axios.get.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringMatching(/\/trace$/),
      expect.stringMatching(/\/source$/),
    ]);
  });

  test("unavailable trace shows contextual state and never requests source", async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        ...trace,
        execution: {
          ...trace.execution,
          source: { ...trace.execution.source, available: false },
        },
      },
    });

    render(
      <SourceViewerModal open codename="exec70LCS" onClose={onClose} />
    );

    expect(
      await screen.findByText(
        "La fuente histórica no está disponible para esta ejecución."
      )
    ).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: "Descargar .cpp" })
    ).not.toBeInTheDocument();
  });

  test("download uses the canonical source endpoint", async () => {
    render(
      <SourceViewerModal
        open
        codename="exec70LCS"
        trace={trace}
        onClose={onClose}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Descargar .cpp" })
    );

    await waitFor(() =>
      expect(downloadAuthenticatedFile).toHaveBeenCalledWith(
        expect.stringMatching(
          /api\/executions\/exec70LCS\/source\/download$/
        ),
        "source.cpp"
      )
    );
  });

  test("keeps raw source download available when the UTF-8 preview returns 422", async () => {
    const legacyTrace = {
      ...trace,
      execution: {
        ...trace.execution,
        source: {
          ...trace.execution.source,
          filename: "legacy.cpp",
        },
      },
    };
    axios.get.mockImplementation((url) => {
      if (String(url).endsWith("/trace")) {
        return Promise.resolve({ data: legacyTrace });
      }
      return Promise.reject({
        response: { status: 422 },
      });
    });

    const { container } = render(
      <SourceViewerModal open codename="exec70LCS" onClose={onClose} />
    );

    expect(
      await screen.findByText(
        "La vista previa no puede mostrarse porque la fuente histórica no utiliza codificación UTF-8 válida. Aún puedes descargar el archivo original."
      )
    ).toBeInTheDocument();
    expect(container.querySelector("pre code")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Descargar .cpp" })
    );

    await waitFor(() =>
      expect(downloadAuthenticatedFile).toHaveBeenCalledWith(
        expect.stringMatching(
          /api\/executions\/exec70LCS\/source\/download$/
        ),
        "legacy.cpp"
      )
    );
  });

  test("Escape closes the accessible dialog and source errors stay inside it", async () => {
    axios.get.mockRejectedValueOnce({ response: { status: 404 } });
    render(
      <SourceViewerModal open codename="exec70LCS" onClose={onClose} />
    );

    expect(
      await screen.findByText(
        "La fuente histórica no está disponible para esta ejecución."
      )
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
