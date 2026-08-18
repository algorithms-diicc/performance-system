import axios from "axios";

import downloadAuthenticatedFile, {
  contentDispositionFilename,
} from "./downloadAuthenticatedFile";

jest.mock("axios");

describe("downloadAuthenticatedFile", () => {
  let clickSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    window.URL.createObjectURL = jest.fn(() => "blob:download-1");
    window.URL.revokeObjectURL = jest.fn();
    clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    clickSpy.mockRestore();
  });

  test("downloads authenticated blobs and always revokes the object URL", async () => {
    const blob = new Blob(["data"], { type: "text/csv" });
    axios.get.mockResolvedValue({ data: blob, headers: {} });

    await downloadAuthenticatedFile("/api/file", "fallback.csv");

    expect(axios.get).toHaveBeenCalledWith("/api/file", {
      responseType: "blob",
      withCredentials: true,
    });
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:download-1"
    );
  });

  test("uses a safe server filename when Content-Disposition provides one", async () => {
    axios.get.mockResolvedValue({
      data: new Blob(["source"]),
      headers: {
        "content-disposition": "attachment; filename=source.cpp",
      },
    });
    const appendSpy = jest.spyOn(document.body, "appendChild");

    await downloadAuthenticatedFile("/api/source", "fallback.cpp");

    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.download).toBe("source.cpp");
    appendSpy.mockRestore();
  });

  test("parses quoted and UTF-8 response filenames", () => {
    expect(
      contentDispositionFilename('attachment; filename="manifest.json"')
    ).toBe("manifest.json");
    expect(
      contentDispositionFilename(
        "attachment; filename*=UTF-8''c%C3%B3digo.cpp"
      )
    ).toBe("código.cpp");
  });
});
