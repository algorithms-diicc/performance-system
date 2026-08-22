import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import JSZip from "jszip";

import { I18nProvider } from "../../../i18n";
import useZipAnalysis from "./useZipAnalysis";

jest.mock("jszip", () => ({
  __esModule: true,
  default: { loadAsync: jest.fn() },
}));

function Harness({ archive }) {
  const { analyzeArchiveFile, file, fileMeta, fileError } = useZipAnalysis();

  return (
    <>
      <button type="button" onClick={() => analyzeArchiveFile(archive)}>
        Load historical archive
      </button>
      <span data-testid="filename">{file?.name || ""}</span>
      <span data-testid="source-count">{fileMeta?.sourceCount ?? ""}</span>
      <span data-testid="c-count">{fileMeta?.cCount ?? ""}</span>
      <span data-testid="cpp-count">{fileMeta?.cppCount ?? ""}</span>
      <span data-testid="sample">
        {(fileMeta?.sourceSample || []).join("|")}
      </span>
      <span role="alert">{fileError}</span>
    </>
  );
}

describe("useZipAnalysis programmatic archive load", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("preserves interleaved C/C++ order and counts each language", async () => {
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("a.cpp", { dir: false });
        callback("b.c", { dir: false });
        callback("c.CPP", { dir: false });
        callback("d.C", { dir: false });
        callback("README.md", { dir: false });
      },
    });
    const archive = new File(["zip"], "historical.zip", {
      type: "application/zip",
    });
    Object.defineProperty(archive, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new ArrayBuffer(3)),
    });

    render(
      <I18nProvider initialLanguage="en">
        <Harness archive={archive} />
      </I18nProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load historical archive" })
    );

    await waitFor(() =>
      expect(screen.getByTestId("filename")).toHaveTextContent(
        "historical.zip"
      )
    );
    expect(screen.getByTestId("source-count")).toHaveTextContent("4");
    expect(screen.getByTestId("c-count")).toHaveTextContent("2");
    expect(screen.getByTestId("cpp-count")).toHaveTextContent("2");
    expect(screen.getByTestId("sample")).toHaveTextContent(
      "a.cpp|b.c|c.CPP|d.C"
    );
    expect(JSZip.loadAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  test("accepts a C-only ZIP", async () => {
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("src/main.c", { dir: false });
      },
    });
    const archive = new File(["zip"], "c-only.zip", {
      type: "application/zip",
    });
    Object.defineProperty(archive, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new ArrayBuffer(3)),
    });

    render(
      <I18nProvider initialLanguage="en">
        <Harness archive={archive} />
      </I18nProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load historical archive" })
    );

    await waitFor(() =>
      expect(screen.getByTestId("source-count")).toHaveTextContent("1")
    );
    expect(screen.getByTestId("c-count")).toHaveTextContent("1");
    expect(screen.getByTestId("cpp-count")).toHaveTextContent("0");
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  test("rejects a ZIP without supported C/C++ sources", async () => {
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("README.md", { dir: false });
        callback("header.h", { dir: false });
      },
    });
    const archive = new File(["zip"], "empty.zip", {
      type: "application/zip",
    });
    Object.defineProperty(archive, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new ArrayBuffer(3)),
    });

    render(
      <I18nProvider initialLanguage="en">
        <Harness archive={archive} />
      </I18nProvider>
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Load historical archive" })
    );

    expect(
      await screen.findByText(
        "The ZIP must contain at least one .c or .cpp file."
      )
    ).toBeInTheDocument();
  });
});
