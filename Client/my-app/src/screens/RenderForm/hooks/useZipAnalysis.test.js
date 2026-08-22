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
      <span data-testid="count">{fileMeta?.cppCount ?? ""}</span>
      <span role="alert">{fileError}</span>
    </>
  );
}

describe("useZipAnalysis programmatic archive load", () => {
  test("runs a downloaded File through the same ZIP inspection", async () => {
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("src/main.cpp", { dir: false });
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
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(JSZip.loadAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });
});
