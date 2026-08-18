import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import JSZip from "jszip";

import RenderFormPage from "./RenderFormPage";

jest.mock("axios");
jest.mock("jszip", () => ({
  __esModule: true,
  default: { loadAsync: jest.fn() },
}));

jest.mock("./components/HeaderSection", () => () => null);
jest.mock("./components/AcademicCourseCard", () => () => null);
jest.mock("./components/MeasurementAndProfileSection", () => () => null);

jest.mock("./components/TestTypeAndParamsCard", () => {
  const ReactModule = require("react");
  return function MockTestTypeAndParamsCard({ onTaskChange }) {
    return ReactModule.createElement(
      "button",
      {
        type: "button",
        onClick: () => onTaskChange("lcs"),
      },
      "Seleccionar benchmark"
    );
  };
});

jest.mock("./components/StatusPanel", () => {
  const ReactModule = require("react");
  return function MockStatusPanel({
    isSubmitDisabled,
    onReset,
  }) {
    return ReactModule.createElement(
      ReactModule.Fragment,
      null,
      ReactModule.createElement(
        "button",
        { type: "submit", disabled: isSubmitDisabled },
        "Revisar y ejecutar"
      ),
      ReactModule.createElement(
        "button",
        { type: "button", onClick: onReset },
        "Limpiar configuración"
      )
    );
  };
});

jest.mock("./components/OverviewModal", () => {
  const ReactModule = require("react");
  return function MockOverviewModal({ visible, onConfirm }) {
    if (!visible) return null;
    return ReactModule.createElement(
      "button",
      { type: "button", onClick: onConfirm },
      "Confirmar y ejecutar"
    );
  };
});

jest.mock("./hooks/useExecutionPolling", () => () => ({
  messages: [],
  executionFiles: [],
  allDone: false,
  allTerminal: false,
  hasError: false,
  firstErrorMessage: "",
  requestError: "",
  retryPolling: jest.fn(),
}));

const DRAFT_KEY = "renderFormDraft_v2";
const currentUser = {
  id: 7,
  email: "student@inf.udec.cl",
  role_name: "Student",
};

const courseResponse = {
  data: {
    items: [],
    selectionRequired: false,
  },
};

const makeZip = (filename) => {
  const file = new File(["zip-content"], filename, {
    type: "application/zip",
  });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
  });
  return file;
};

const renderPage = async (route = "/new-analysis") => {
  const view = render(
    <MemoryRouter initialEntries={[route]}>
      <RenderFormPage currentUser={currentUser} />
    </MemoryRouter>
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const selectZipFromInput = async (filename) => {
  const file = makeZip(filename);
  const input = screen.getByLabelText(/Archivo de código/);

  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  await screen.findByText(filename, { selector: ".file-meta-name" });
  return file;
};

const dropZip = async (filename) => {
  const file = makeZip(filename);
  const dropzone = screen.getByRole("button", {
    name: "Seleccionar archivo de código ZIP",
  });

  await act(async () => {
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });
  });

  await screen.findByText(filename, { selector: ".file-meta-name" });
  return file;
};

const selectBenchmark = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Seleccionar benchmark" })
  );
};

const submitThroughOverview = async () => {
  const review = screen.getByRole("button", {
    name: "Revisar y ejecutar",
  });
  await waitFor(() => expect(review).toBeEnabled());
  fireEvent.click(review);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Confirmar y ejecutar",
    })
  );
  await waitFor(() => expect(axios).toHaveBeenCalledTimes(1));
  return axios.mock.calls[0][0].data;
};

describe("RenderFormPage 6A onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.alert = jest.fn();

    axios.get.mockResolvedValue(courseResponse);
    axios.mockReturnValue(new Promise(() => {}));
    JSZip.loadAsync.mockResolvedValue({
      forEach(callback) {
        callback("src/main.cpp", { dir: false });
      },
    });
  });

  test("file input suggests a title while preserving the real filename", async () => {
    await renderPage();
    await selectZipFromInput("mi.algoritmo.v2.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "mi.algoritmo.v2"
    );
    expect(
      screen.getByText("mi.algoritmo.v2.zip", {
        selector: ".file-meta-name",
      })
    ).toBeInTheDocument();
  });

  test("drag and drop uses the same title suggestion behavior", async () => {
    await renderPage();
    await dropZip("ARRASTRADO.ZIP");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "ARRASTRADO"
    );
  });

  test("a manual title set before the ZIP is not overwritten", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Nombre del test"), {
      target: { value: "Título manual" },
    });

    await selectZipFromInput("archivo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Título manual"
    );
  });

  test("an untouched suggestion follows a replacement ZIP", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    await selectZipFromInput("segundo.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "segundo"
    );
  });

  test("editing an automatic title protects it from replacement ZIPs", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    fireEvent.change(screen.getByLabelText("Nombre del test"), {
      target: { value: "Título ajustado" },
    });
    await selectZipFromInput("segundo.zip");

    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Título ajustado"
    );
  });

  test("clearing the title stays empty until another ZIP is selected", async () => {
    await renderPage();
    await selectZipFromInput("primero.zip");
    const title = screen.getByLabelText("Nombre del test");

    fireEvent.change(title, { target: { value: "" } });
    expect(title).toHaveValue("");

    await selectZipFromInput("reemplazo.zip");
    expect(title).toHaveValue("reemplazo");
  });

  test("draft title and note load retrocompatibly as manual data", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        version: 1,
        testName: "Borrador recuperado",
        note: "Recordar comparar con la versión base",
      })
    );

    await renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre del test")).toHaveValue(
        "Borrador recuperado"
      )
    );
    expect(screen.getByLabelText(/Nota personal/)).toHaveValue(
      "Recordar comparar con la versión base"
    );

    await selectZipFromInput("nuevo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Borrador recuperado"
    );
  });

  test("an old draft without note loads the empty optional field", async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ version: 1, testName: "Borrador antiguo" })
    );

    await renderPage();
    await waitFor(() =>
      expect(screen.getByLabelText(/Nota personal/)).toHaveValue("")
    );
  });

  test("a title recovered from an execution remains manual", async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes("api/student/courses")) {
        return Promise.resolve(courseResponse);
      }
      return Promise.resolve({
        data: {
          execution: {
            publicId: "uuid-1",
            codename: "recoverLCS",
            originalFilename: "original.cpp",
            submissionTitle: "Ejecución recuperada",
            benchmark: "LCS",
            inputSize: 500,
            samples: 30,
            terminal: true,
          },
        },
      });
    });

    await renderPage("/new-analysis?execution=uuid-1");
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre del test")).toHaveValue(
        "Ejecución recuperada"
      )
    );

    await selectZipFromInput("reemplazo.zip");
    expect(screen.getByLabelText("Nombre del test")).toHaveValue(
      "Ejecución recuperada"
    );
  });

  test("note is secondary, editable, counted and limited to 500", async () => {
    await renderPage();
    const title = screen.getByLabelText("Nombre del test");
    const note = screen.getByLabelText(/Nota personal/);

    expect(title).toHaveAttribute("maxLength", "255");
    expect(note).toHaveAttribute("maxLength", "500");
    expect(screen.getByText("Solo tú podrás ver esta nota.")).toBeInTheDocument();
    expect(screen.getByText("0 / 500 caracteres")).toBeInTheDocument();

    fireEvent.change(title, { target: { value: "Título independiente" } });
    fireEvent.change(note, { target: { value: "nota" } });

    expect(title).toHaveValue("Título independiente");
    expect(note).toHaveValue("nota");
    expect(screen.getByText("4 / 500 caracteres")).toBeInTheDocument();
  });

  test("draft autosave includes note and reset clears it", async () => {
    await renderPage();
    const note = screen.getByLabelText(/Nota personal/);
    fireEvent.change(note, { target: { value: "Nota del borrador" } });

    await waitFor(() => {
      const draft = JSON.parse(window.localStorage.getItem(DRAFT_KEY));
      expect(draft.note).toBe("Nota del borrador");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Limpiar configuración" })
    );
    expect(note).toHaveValue("");
  });

  test("FormData sends trimmed title and non-empty note atomically", async () => {
    await renderPage();
    await selectZipFromInput("algoritmos.zip");
    selectBenchmark();
    fireEvent.change(screen.getByLabelText(/Nota personal/), {
      target: { value: "  Nota privada  " },
    });

    const formData = await submitThroughOverview();
    expect(formData.get("title")).toBe("algoritmos");
    expect(formData.get("note")).toBe("Nota privada");
    expect(formData.get("file").name).toBe("algoritmos.zip");
  });

  test("empty note does not block submit and is omitted from FormData", async () => {
    await renderPage();
    await selectZipFromInput(".zip");
    selectBenchmark();

    const formData = await submitThroughOverview();
    expect(formData.get("title")).toBe("Entrada de texto");
    expect(formData.get("note")).toBeNull();
    expect(formData.get("file").name).toBe(".zip");
  });
});
