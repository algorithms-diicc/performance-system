// src/screens/RenderForm/RenderFormPage.js
import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { serverURL } from "../../common/Constants.js";
import { useI18n } from "../../i18n";
import {
  buildExecutionSearch,
  buildRecoveredExecutionState,
  parseExecutionPublicIds,
} from "./recovery/executionRecoveryModel";
import {
  buildReuseConfiguration,
  parseReusePublicId,
} from "./reuse/executionReuseModel";
import {
  applyArchiveTitleSuggestion,
  manualSubmissionTitle,
  normalizeDraftNote,
  resolveSubmissionTitle,
} from "./formOnboardingModel";
import {
  resolveCourseQuerySelection,
} from "./courseOnboardingModel";
import {
  resolveResultsDestination,
} from "../submissionOverviewModel";

import HeaderSection from "./components/HeaderSection";
import TestNameAndUploadCard from "./components/TestNameAndUploadCard";
import TestTypeAndParamsCard from "./components/TestTypeAndParamsCard";
import MeasurementAndProfileSection from "./components/MeasurementAndProfileSection";
import StatusPanel from "./components/StatusPanel";
import OverviewModal from "./components/OverviewModal";
import AcademicCourseCard from "./components/AcademicCourseCard";

import getTask, {
  numericalInputOptions,
  baseURL,
  tasks,
} from "../../common/Constants.js";

import useZipAnalysis from "./hooks/useZipAnalysis";
import useExecutionPolling from "./hooks/useExecutionPolling";

import "./RenderForm.css";

/**
 * Clave usada para guardar el borrador en localStorage.
 */
const RENDER_FORM_DRAFT_KEY = "renderFormDraft_v2";

/**
 * Parámetros por defecto por tipo de test
 */
const defaultParams = {
  lcs: { inputSize: 500, samples: 30 },
  camm: { inputSize: 5000, samples: 30 },
  size: { inputSize: 2500, samples: 30 },
};

/**
 * Presets rápidos que se muestran como chips
 */
const inputSizePresets = {
  lcs: [500, 750, 1000],
  camm: [2000, 5000, 10000],
  size: [1000, 2500, 5000],
};

const samplesPresets = [10, 20, 30];

/**
 * El backend actual no ofrece selección de hardware.
 * Por eso el entorno se presenta como información y no como un selector.
 */
const executionEnvironment = {
  name: "Entorno de medición administrado",
  badge: "Automático",
  description:
    "Performance System enviará la prueba al nodo de medición configurado para esta instalación.",
  note:
    "La selección manual de hardware se habilitará cuando exista soporte real en el backend.",
};

/**
 * Perfiles pedagógicos.
 *
 * En el contrato actual solo controlan "samples".
 * El backend no recibe el nombre del perfil: recibe el valor concreto.
 */
const executionProfiles = [
  {
    id: "rapido",
    name: "Rápido",
    badge: "Exploración",
    samples: 10,
    description:
      "Útil para comprobar rápidamente el comportamiento general antes de realizar una medición más extensa.",
  },
  {
    id: "equilibrado",
    name: "Equilibrado",
    badge: "Recomendado",
    samples: 30,
    description:
      "Balance entre tiempo de ejecución y estabilidad de las mediciones. Es la opción recomendada para uso general.",
  },
  {
    id: "exhaustivo",
    name: "Exhaustivo",
    badge: "Mayor estabilidad",
    samples: 50,
    description:
      "Aumenta las repeticiones para observar con mayor estabilidad la variabilidad entre mediciones.",
  },
  {
    id: "personalizado",
    name: "Personalizado",
    badge: "Control manual",
    samples: null,
    description:
      "Permite definir manualmente el número de repeticiones por punto de medición.",
  },
];

const EXECUTION_PROFILE_SAMPLES = {
  rapido: 10,
  equilibrado: 30,
  exhaustivo: 50,
};

const inferExecutionProfileFromSamples = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "personalizado";
  }

  const match = Object.entries(
    EXECUTION_PROFILE_SAMPLES
  ).find(([, profileSamples]) => profileSamples === numeric);

  return match?.[0] || "personalizado";
};

/**
 * Nombres pedagógicos. Los IDs internos se conservan porque forman parte
 * del contrato existente con el backend.
 */
const taskDisplayNames = {
  lcs: "Entrada de texto",
  camm: "Datos numéricos",
  size: "Tamaño parametrizado",
};

const taskSubtitles = {
  lcs:
    "Analiza algoritmos que procesan texto utilizando el dataset english.50MB.",
  camm:
    "Analiza algoritmos sobre colecciones numéricas con distintas distribuciones.",
  size:
    "Analiza algoritmos cuyo tamaño de problema se entrega como argumento entero.",
};

const taskDescriptions = {
  lcs:
    "El motor evalúa el programa con tamaños crecientes de entrada tomados desde el dataset de texto. Cada punto se repite según el perfil de medición seleccionado.",
  camm:
    "El motor evalúa el programa con conjuntos numéricos de tamaño creciente. Puedes elegir la distribución de los datos para estudiar cómo afecta al comportamiento del algoritmo.",
  size:
    "El motor ejecuta el programa con valores crecientes del parámetro de entrada. Es útil cuando el algoritmo genera o administra sus datos a partir de un tamaño recibido como argumento.",
};

const taskIcons = {
  lcs: "📝",
  camm: "🔢",
  size: "📏",
};

const taskBadges = {
  lcs: "Dataset de texto",
  camm: "Dataset numérico",
  size: "Argumento entero",
};

const inputSizeHelp = {
  lcs:
    "Cantidad máxima de líneas de texto que alcanzará el benchmark.",
  camm:
    "Cantidad máxima de valores numéricos que alcanzará el benchmark.",
  size:
    "Valor máximo que se entregará al programa como tamaño del problema.",
};

/**
 * Corrige solamente la presentación de etiquetas; los valores internos
 * CAMMR / CAMMSO / CAMMS se conservan.
 */
const numericalInputOptionsUI = numericalInputOptions.map((option) => {
  const labels = {
    cammr: "Números aleatorios",
    cammso: "Números semiordenados",
    camms: "Números iguales",
  };

  return {
    ...option,
    label: labels[option.value] || option.label,
  };
});

/**
 * Límites por tipo de test para inputSize y samples.
 */
const PARAM_LIMITS = {
  lcs: {
    inputSize: { min: 100, max: 50000, step: 100 },
    samples: { min: 1, max: 100, step: 1 },
  },
  camm: {
    inputSize: { min: 1000, max: 150000, step: 1000 },
    samples: { min: 1, max: 100, step: 1 },
  },
  size: {
    inputSize: { min: 100, max: 100000, step: 100 },
    samples: { min: 1, max: 100, step: 1 },
  },
};

const messageState = (key, params = {}) => ({
  key,
  params,
});

const resolveMessageState = (state, t) => {
  if (!state) return "";
  if (typeof state === "string") return state;
  return t(state.key, state.params || {});
};

const normalizeRecoveredTaskId = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "lcs") return "lcs";
  if (normalized === "size") return "size";
  if (normalized.startsWith("camm")) return "camm";
  return "";
};

const normalizeRecoveredDataType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return ["cammr", "cammso", "camms"].includes(normalized)
    ? normalized
    : "";
};

const normalizeRecoveredProfileId = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const map = {
    quick: "rapido",
    rapido: "rapido",
    balanced: "equilibrado",
    equilibrado: "equilibrado",
    exhaustive: "exhaustivo",
    exhaustivo: "exhaustivo",
    custom: "personalizado",
    personalizado: "personalizado",
  };

  return map[normalized] || "";
};

function RenderFormPage({ currentUser }) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // ======= Estado general del formulario =======
  const [titleState, setTitleState] = useState(() =>
    manualSubmissionTitle("")
  );
  const testName = titleState.value;
  const [note, setNote] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState("");
  const [inputSize, setInputSize] = useState(1000);
  const [samples, setSamples] = useState(30);
  const [paramErrors, setParamErrors] = useState({
    inputSize: "",
    samples: "",
  });

  const [dataType, setDataType] = useState("");
  const [executionProfile, setExecutionProfile] = useState("equilibrado");

  const [fileList, setFileList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [executionSnapshot, setExecutionSnapshot] = useState(null);
  const submitRequestLockRef = useRef(false);

  // ======= Contexto académico CORE-07F-5 =======
  const [activeCourses, setActiveCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [courseSelectionRequired, setCourseSelectionRequired] =
    useState(false);
  const [courseContextLoading, setCourseContextLoading] = useState(true);
  const [courseContextError, setCourseContextError] = useState("");
  const [courseContextReloadToken, setCourseContextReloadToken] =
    useState(0);

  // ======= Análisis de .zip (hook dedicado) =======
  const {
    file,
    fileError,
    fileMeta,
    isDraggingFile,
    isInspectingZip,
    MAX_ZIP_MB,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    reset: resetZipAnalysis,
  } = useZipAnalysis();

  // File input y drag & drop convergen en el mismo `fileMeta` validado.
  // Así la sugerencia se aplica una sola vez por cambio observable de ZIP.
  useEffect(() => {
    if (!fileMeta) return;

    setTitleState((current) =>
      applyArchiveTitleSuggestion(current, fileMeta.name)
    );
  }, [fileMeta]);

  // ======= Polling de estado para cada archivo (hook dedicado) =======
  const {
    messages,
    executionFiles,
    allDone,
    allTerminal,
    hasError,
    firstErrorMessage,
    requestError: pollingRequestError,
    retryPolling,
  } = useExecutionPolling(
    fileList,
    executionSnapshot?.executions
  );

  // ======= CORE-07F-5: cursos activos del estudiante =======
  useEffect(() => {
    let cancelled = false;

    const loadActiveCourses = async () => {
      try {
        setCourseContextLoading(true);
        setCourseContextError("");

        const response = await axios.get(
          `${serverURL}api/student/courses`,
          {
            withCredentials: true,
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (cancelled) return;

        const items = Array.isArray(response.data?.items)
          ? response.data.items
          : [];

        const requiresSelection =
          response.data?.selectionRequired === true ||
          items.length > 1;

        setActiveCourses(items);
        setCourseSelectionRequired(requiresSelection);

        setSelectedCourseId((previous) => {
          if (items.length === 0) {
            return "";
          }

          if (items.length === 1) {
            return String(
              response.data?.autoSelectedCourseId ??
              items[0].id
            );
          }

          const previousStillExists = items.some(
            (course) =>
              String(course.id) === String(previous)
          );

          return previousStillExists
            ? String(previous)
            : "";
        });
      } catch (error) {
        if (cancelled) return;

        setActiveCourses([]);
        setSelectedCourseId("");
        setCourseSelectionRequired(false);

        const status = error?.response?.status;
        const key =
          status === 401
            ? "renderForm.page.errors.coursesSession"
            : status === 403
            ? "renderForm.page.errors.coursesForbidden"
            : "renderForm.page.errors.courses";

        setCourseContextError(messageState(key));
      } finally {
        if (!cancelled) {
          setCourseContextLoading(false);
        }
      }
    };

    loadActiveCourses();

    return () => {
      cancelled = true;
    };
  }, [courseContextReloadToken]);

  // ======= 6B-B: contexto académico sugerido desde la URL =======
  useEffect(() => {
    if (courseContextLoading || courseContextError) {
      return;
    }

    // Precedencia canónica:
    // execution > reuse > course.
    if (
      parseExecutionPublicIds(location.search).length > 0 ||
      parseReusePublicId(location.search)
    ) {
      return;
    }

    // Con 0/1 cursos se conserva el contrato canónico existente:
    // sin asociación o selección automática, respectivamente.
    if (activeCourses.length <= 1) {
      return;
    }

    const querySelection = resolveCourseQuerySelection(
      location.search,
      activeCourses
    );

    if (querySelection !== null) {
      setSelectedCourseId(querySelection);
    }
  }, [
    activeCourses,
    courseContextError,
    courseContextLoading,
    location.search,
  ]);


  // ======= CORE-04D-3: recuperación persistente desde la URL =======
  useEffect(() => {
    const publicIds = parseExecutionPublicIds(location.search);

    if (publicIds.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const restoreExecution = async () => {
      try {
        const responses = await Promise.all(
          publicIds.map((publicId) =>
            axios.get(
              `${serverURL}api/executions/${encodeURIComponent(publicId)}`,
              {
                withCredentials: true,
                headers: {
                  "Cache-Control": "no-cache",
                  Pragma: "no-cache",
                },
              }
            )
          )
        );

        if (cancelled) return;

        const snapshots = responses
          .map((response) => response.data?.execution || null)
          .filter(Boolean);

        const recovered = buildRecoveredExecutionState(snapshots);

        if (!recovered) {
          setSubmissionError(
            messageState(
              "renderForm.page.errors.restoreInvalid"
            )
          );
          return;
        }

        const first = recovered.firstSnapshot;

        setExecutionSnapshot({
          ...recovered.executionSnapshot,
          recoveredTaskId: normalizeRecoveredTaskId(
            first?.benchmark
          ),
          recoveredDataType: normalizeRecoveredDataType(
            first?.benchmark
          ),
          recoveredProfileId: normalizeRecoveredProfileId(
            first?.executionProfile
          ),
          recoveredHardwareProfile: String(
            first?.hardwareProfile || ""
          ).trim(),
          recoveredSubmissionTitle: String(
            first?.submissionTitle || ""
          ).trim(),
          recoveredFileCount: recovered.fileList.length,
        });
        setFileList(recovered.fileList);
        setShowOverview(false);
        setSubmissionError("");
        setIsSubmitting(!recovered.allTerminal);

        if (first?.submissionTitle) {
          setTitleState(
            manualSubmissionTitle(first.submissionTitle)
          );
        }
        if (first?.inputSize !== null && first?.inputSize !== undefined) {
          setInputSize(first.inputSize);
        }
        if (first?.samples !== null && first?.samples !== undefined) {
          setSamples(first.samples);
        }
      } catch (error) {
        if (cancelled) return;

        console.error(
          "❌ Error al recuperar ejecución persistente:",
          error
        );

        const status = error?.response?.status;
        const key =
          status === 401
            ? "renderForm.page.errors.restoreSession"
            : status === 403
            ? "renderForm.page.errors.restoreForbidden"
            : status === 404
            ? "renderForm.page.errors.restoreNotFound"
            : "renderForm.page.errors.restoreGeneric";

        setSubmissionError(messageState(key));
      }
    };

    restoreExecution();

    return () => {
      cancelled = true;
    };
  }, [location.search]);

  // ======= Carga de borrador inicial desde localStorage =======
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(RENDER_FORM_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);
      if (!draft || draft.version !== 1) return;

      const {
        testName: savedTestName = "",
        note: savedNote = "",
        selectedTaskType: savedTaskType = "",
        inputSize: savedInputSize,
        samples: savedSamples,
        dataType: savedDataType = "",
        executionProfile: savedProfile = "equilibrado",
      } = draft;

      setTitleState(manualSubmissionTitle(savedTestName));
      setNote(normalizeDraftNote(savedNote));
      setSelectedTaskType(savedTaskType || "");
      setDataType(savedDataType);
      setExecutionProfile(savedProfile);

      if (savedTaskType && PARAM_LIMITS[savedTaskType]) {
        const limitsInput = PARAM_LIMITS[savedTaskType].inputSize;
        const limitsSamples = PARAM_LIMITS[savedTaskType].samples;

        const clampNumber = (value, min, max, fallback) => {
          if (typeof value !== "number" || Number.isNaN(value)) {
            return fallback;
          }
          return Math.min(max, Math.max(min, value));
        };

        const safeInputSize = clampNumber(
          savedInputSize,
          limitsInput.min,
          limitsInput.max,
          limitsInput.min
        );
        const safeSamples = clampNumber(
          savedSamples,
          limitsSamples.min,
          limitsSamples.max,
          limitsSamples.min
        );

        setInputSize(safeInputSize);
        setSamples(safeSamples);
      } else {
        setInputSize(
          typeof savedInputSize === "number" && !Number.isNaN(savedInputSize)
            ? savedInputSize
            : 1000
        );
        setSamples(
          typeof savedSamples === "number" && !Number.isNaN(savedSamples)
            ? savedSamples
            : 30
        );
      }

      setParamErrors({ inputSize: "", samples: "" });
    } catch (e) {
      console.error("Error al cargar configuración previa del test:", e);
    }
  }, []);

  // ======= ITERATION 7F: reutilización de configuración histórica =======
  useEffect(() => {
    // Recuperación persistente tiene precedencia sobre reutilización.
    if (parseExecutionPublicIds(location.search).length > 0) {
      return undefined;
    }

    const reusePublicId = parseReusePublicId(
      location.search
    );

    if (!reusePublicId) {
      return undefined;
    }

    // Esperamos el contexto académico para no reutilizar un curso
    // que ya no esté disponible para el usuario.
    if (courseContextLoading || courseContextError) {
      return undefined;
    }

    let cancelled = false;

    const loadReuseConfiguration = async () => {
      try {
        const response = await axios.get(
          `${serverURL}api/executions/${encodeURIComponent(
            reusePublicId
          )}/reuse`,
          {
            withCredentials: true,
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          }
        );

        if (cancelled) return;

        const reuse = buildReuseConfiguration(
          response.data?.reuse || null,
          activeCourses
        );

        if (!reuse) {
          setSubmissionError(
            messageState(
              "renderForm.page.errors.reuseInvalid"
            )
          );
          return;
        }

        setSelectedTaskType(
          reuse.selectedTaskType
        );
        setDataType(reuse.dataType);

        if (
          reuse.inputSize !== null &&
          reuse.inputSize !== undefined
        ) {
          setInputSize(reuse.inputSize);
        }

        if (
          reuse.samples !== null &&
          reuse.samples !== undefined
        ) {
          setSamples(reuse.samples);
        }

        setExecutionProfile(
          reuse.executionProfile
        );

        if (reuse.courseId !== null) {
          setSelectedCourseId(
            reuse.courseId
          );
        }

        setParamErrors({
          inputSize: "",
          samples: "",
        });
        setExecutionSnapshot(null);
        setFileList([]);
        setShowOverview(false);
        setIsSubmitting(false);
        setSubmissionError("");
      } catch (error) {
        if (cancelled) return;

        const status = error?.response?.status;
        const key =
          status === 401
            ? "renderForm.page.errors.reuseSession"
            : status === 403
            ? "renderForm.page.errors.reuseForbidden"
            : status === 404
            ? "renderForm.page.errors.reuseNotFound"
            : "renderForm.page.errors.reuseGeneric";

        setSubmissionError(messageState(key));
      }
    };

    loadReuseConfiguration();

    return () => {
      cancelled = true;
    };
  }, [
    activeCourses,
    courseContextError,
    courseContextLoading,
    location.search,
  ]);

  // Cuando todos los archivos llegan a un estado terminal,
  // se detiene el modo de ejecución.
  useEffect(() => {
    if (allTerminal && fileList.length > 0) {
      setIsSubmitting(false);
    }
  }, [allTerminal, fileList.length]);

  // ======= Guardado automático de borrador en localStorage =======
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const draft = {
        version: 1,
        testName,
        note,
        selectedTaskType,
        inputSize:
          typeof inputSize === "number" && !Number.isNaN(inputSize)
            ? inputSize
            : null,
        samples:
          typeof samples === "number" && !Number.isNaN(samples)
            ? samples
            : null,
        dataType,
        executionProfile,
      };

      window.localStorage.setItem(
        RENDER_FORM_DRAFT_KEY,
        JSON.stringify(draft)
      );
    } catch (e) {
      console.warn("No se pudo guardar la configuración del test:", e);
    }
  }, [
    testName,
    note,
    selectedTaskType,
    inputSize,
    samples,
    dataType,
    executionProfile,
  ]);

  // ======= Helpers de validación de parámetros =======
  const getLimits = (field) => {
    if (!selectedTaskType) return null;
    return PARAM_LIMITS[selectedTaskType]?.[field] || null;
  };

  const validateParam = (field, rawValue) => {
    const limits = getLimits(field);
    if (!limits) return;

    let error = null;

    if (
      rawValue === "" ||
      rawValue === null ||
      rawValue === undefined
    ) {
      error = messageState(
        "renderForm.page.validations.numberRequired"
      );
    } else {
      const num = Number(rawValue);

      if (Number.isNaN(num)) {
        error = messageState(
          "renderForm.page.validations.numberInvalid"
        );
      } else if (num < limits.min) {
        error = messageState(
          "renderForm.page.validations.minimum",
          { min: limits.min }
        );
      } else if (num > limits.max) {
        error = messageState(
          "renderForm.page.validations.maximum",
          { max: limits.max }
        );
      }
    }

    setParamErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  };

  const handleInputSizeChange = (e) => {
    const raw = e.target.value;
    const value = raw === "" ? "" : Number(raw);
    setInputSize(value);
    validateParam("inputSize", raw);
  };

  const handleTestNameChange = (value) => {
    setTitleState(manualSubmissionTitle(value));
  };

  const handleInputSizeSliderChange = (e) => {
    const value = Number(e.target.value);
    setInputSize(value);
    validateParam("inputSize", value);
  };

  const handleSamplesChange = (e) => {
    const raw = e.target.value;
    const value = raw === "" ? "" : Number(raw);

    setSamples(value);
    setExecutionProfile(
      inferExecutionProfileFromSamples(value)
    );
    validateParam("samples", raw);
  };

  const handleSamplesSliderChange = (e) => {
    const value = Number(e.target.value);

    setSamples(value);
    setExecutionProfile(
      inferExecutionProfileFromSamples(value)
    );
    validateParam("samples", value);
  };

  // ======= Selección de tipo de benchmark =======
  const handleTaskChange = (taskId) => {
    if (selectedTaskType !== taskId) {
      setDataType("");
    }

    setSelectedTaskType(taskId);

    const params = defaultParams[taskId];

    if (params) {
      setInputSize(params.inputSize);

      const profileSamples =
        EXECUTION_PROFILE_SAMPLES[executionProfile];

      if (typeof profileSamples === "number") {
        setSamples(profileSamples);
      } else if (
        typeof samples !== "number" ||
        Number.isNaN(samples)
      ) {
        setSamples(params.samples);
      }
    }

    setParamErrors({
      inputSize: "",
      samples: "",
    });
  };

  const handleDataTypeChange = (type) => {
    setDataType(type);
  };

  // ======= Perfil de medición ↔ samples =======
  const handleExecutionProfileChange = (profileId) => {
    setExecutionProfile(profileId);

    const suggestedSamples =
      EXECUTION_PROFILE_SAMPLES[profileId];

    if (typeof suggestedSamples !== "number") {
      return;
    }

    const limits = getLimits("samples");

    let newSamples = suggestedSamples;

    if (limits) {
      newSamples = Math.min(
        limits.max,
        Math.max(limits.min, newSamples)
      );
    }

    setSamples(newSamples);
    validateParam("samples", newSamples);
  };

  // ======= Reset completo del formulario =======
  const handleResetForm = () => {
    setTitleState(manualSubmissionTitle(""));
    setNote("");
    setSelectedTaskType("");
    setInputSize(1000);
    setSamples(30);
    setParamErrors({ inputSize: "", samples: "" });
    setDataType("");
    setExecutionProfile("equilibrado");

    setFileList([]);
    setIsSubmitting(false);
    setShowOverview(false);
    setSubmissionError("");
    if (location.search) {
      navigate(
        { pathname: location.pathname, search: "" },
        { replace: true }
      );
    }
    setExecutionSnapshot(null);

    // reset de archivo (.zip)
    resetZipAnalysis();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // limpia borrador en localStorage
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(RENDER_FORM_DRAFT_KEY);
      }
    } catch (e) {
      console.warn("No se pudo limpiar el borrador del test:", e);
    }
  };

  // ======= Envío del formulario =======
  const handleOpenOverview = (event) => {
    event.preventDefault();

    // Chequeos básicos
    if (!file) {
      alert(t("renderForm.page.alerts.fileRequired"));
      return;
    }
    if (!selectedTaskType) {
      alert(t("renderForm.page.alerts.benchmarkRequired"));
      return;
    }
    if (fileError) {
      alert(t("renderForm.page.alerts.fileError"));
      return;
    }
    if (paramErrors.inputSize || paramErrors.samples) {
      alert(t("renderForm.page.alerts.parameterError"));
      return;
    }
    if (selectedTaskType === "camm" && !dataType) {
      alert(t("renderForm.page.alerts.dataTypeRequired"));
      return;
    }
    if (courseContextLoading) {
      alert(t("renderForm.page.alerts.courseLoading"));
      return;
    }
    if (courseContextError) {
      alert(t("renderForm.page.alerts.courseUnavailable"));
      return;
    }
    if (courseSelectionRequired && !selectedCourseId) {
      alert(t("renderForm.page.alerts.courseRequired"));
      return;
    }

    setShowOverview(true);
  };

  const handleConfirmExecution = () => {
    if (!file || !selectedTaskType) return;

    /*
     * Bloqueo sincrónico adicional al estado isSubmitting.
     *
     * React actualiza el estado de forma asíncrona, por lo que dos clics
     * extremadamente rápidos podrían entrar al handler antes del rerender.
     * El ref se actualiza inmediatamente y evita crear dos submissions.
     */
    if (submitRequestLockRef.current) return;
    submitRequestLockRef.current = true;

    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);

    const safeInputSize =
      typeof inputSize === "number" ? inputSize : Number(inputSize) || 0;
    const safeSamples =
      typeof samples === "number" ? samples : Number(samples) || 0;

    bodyFormData.append("input_size", safeInputSize);
    bodyFormData.append("samples", safeSamples);

    const taskKeyForBackend =
      selectedTaskType === "camm" && dataType
        ? dataType
        : selectedTaskType;

    bodyFormData.append(
      "task_type",
      getTask(taskKeyForBackend)
    );

    bodyFormData.append(
      "title",
      resolveSubmissionTitle({
        testName,
        archiveFilename: file.name,
        fallbackTitle:
          taskDisplayNames[selectedTaskType] || "-",
      })
    );

    const normalizedNote = note.trim();
    if (normalizedNote) {
      bodyFormData.append("note", normalizedNote);
    }

    if (selectedCourseId) {
      bodyFormData.append(
        "course_id",
        selectedCourseId
      );
    }

    if (location.search) {
      navigate(
        { pathname: location.pathname, search: "" },
        { replace: true }
      );
    }

    setExecutionSnapshot({
      testName,
      fileName: file.name,
      taskId: selectedTaskType,
      inputSize,
      samples,
      executionProfileId: executionProfile,
      dataType,
      courseId: selectedCourseId || null,
    });

    setSubmissionError("");
    setIsSubmitting(true);
    setFileList([]);
    setShowOverview(false);

    axios({
      method: "post",
      url: baseURL,
      data: bodyFormData,
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    })
      .then((response) => {
        const executionRecords = Array.isArray(
          response.data?.executions
        )
          ? response.data.executions
          : [];

        const queuedFiles =
          executionRecords.length > 0
            ? executionRecords
                .map((execution) => execution.codename)
                .filter(Boolean)
            : response.data?.cpp_files_queued || [];

        if (
          queuedFiles.length > 0 &&
          queuedFiles[0]?.length > 0
        ) {
          try {
            if (typeof window !== "undefined") {
              window.localStorage.removeItem(
                RENDER_FORM_DRAFT_KEY
              );
            }
          } catch (error) {
            console.warn(
              "No se pudo limpiar el borrador tras registrar la ejecución:",
              error
            );
          }

          setExecutionSnapshot((previous) => ({
            ...(previous || {}),
            submissionId: response.data?.submissionId ?? null,
            executions: executionRecords,
          }));

          const executionSearch = buildExecutionSearch(executionRecords);

          navigate(
            {
              pathname: location.pathname,
              search: executionSearch,
            },
            { replace: true }
          );

          setFileList(queuedFiles);
        } else {
          console.error(
            "No se encontraron ejecuciones en la respuesta del backend."
          );
          setSubmissionError(
            messageState(
              "renderForm.page.errors.submitNoExecutions"
            )
          );
          setIsSubmitting(false);
        }
      })
      .catch((error) => {
        console.error("❌ Error al enviar archivo:", error);

        const status = error?.response?.status;

        const key =
          !error?.response
            ? "renderForm.page.errors.submitNetwork"
            : status === 401
            ? "renderForm.page.errors.submitSession"
            : status === 403
            ? "renderForm.page.errors.submitForbidden"
            : status === 413
            ? "renderForm.page.errors.submitTooLarge"
            : "renderForm.page.errors.submitGeneric";

        setSubmissionError(messageState(key));

        setIsSubmitting(false);
      })
      .finally(() => {
        submitRequestLockRef.current = false;
      });
  };

  const handleCancelOverview = () => {
    setShowOverview(false);
  };

  /**
   * Limpia únicamente el estado de la ejecución anterior.
   * Conserva el formulario para que el estudiante pueda corregir
   * código/parámetros y volver a intentar.
   */
  const handlePrepareRetry = () => {
    setFileList([]);
    setSubmissionError("");
    if (location.search) {
      navigate(
        { pathname: location.pathname, search: "" },
        { replace: true }
      );
    }
    setExecutionSnapshot(null);
    setIsSubmitting(false);
  };

  /**
   * Libera la pantalla para preparar otro experimento.
   *
   * No cancela ni modifica las Executions ya persistidas. El trabajo
   * anterior continúa QUEUED/RUNNING/PROCESSING y permanece accesible
   * desde Historial.
   */
  const handlePrepareNewAnalysis = () => {
    handleResetForm();
  };

  const handleGoToResults = () => {
    const destination = resolveResultsDestination(
      fileList,
      executionSnapshot?.submissionId
    );

    if (!destination.path) {
      if (destination.error) {
        setSubmissionError(
          messageState(
            "renderForm.page.errors.resultsDestination"
          )
        );
      }
      return;
    }

    if (destination.kind === "execution") {
      navigate(destination.path, {
        replace: false,
        state: {
          name: testName || destination.codename,
          codeList: fileList,
        },
      });
      return;
    }

    navigate(destination.path, {
      replace: false,
    });
  };

  // ======= Utilitarios de presentación =======
  const getTaskTitle = (taskId = selectedTaskType) => {
    if (!taskId) return "-";

    const key =
      `renderForm.benchmark.tasks.${taskId}.name`;
    const translated = t(key);

    return translated === key
      ? taskDisplayNames[taskId] || taskId
      : translated;
  };

  const getEnvironmentLabel = () =>
    t("renderForm.measurement.environmentName");

  const getInputSizeLabel = (
    taskId = selectedTaskType,
    value = inputSize
  ) => {
    if (
      value === "" ||
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    if (taskId === "lcs") {
      return t("renderForm.page.inputSize.lines", {
        count: value,
      });
    }

    if (taskId === "camm") {
      return t("renderForm.page.inputSize.values", {
        count: value,
      });
    }

    return String(value);
  };

  const getSamplesLabel = (value = samples) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return "—";
    }

    return t("renderForm.measurement.repetitions", {
      count: numeric,
    });
  };

  const getExecutionProfileLabel = (
    profileId = executionProfile
  ) => {
    if (!profileId) return "-";

    const key =
      `renderForm.measurement.profiles.${profileId}.name`;
    const translated = t(key);

    if (translated !== key) {
      return translated;
    }

    const profile = executionProfiles.find(
      (option) => option.id === profileId
    );

    return profile?.name || profileId;
  };

  const getDataTypeLabel = (type = dataType) => {
    if (!type) {
      return t("renderForm.benchmark.notApplicable");
    }

    const key =
      `renderForm.benchmark.dataTypes.${type}`;
    const translated = t(key);

    if (translated !== key) {
      return translated;
    }

    const option = numericalInputOptionsUI.find(
      (item) => item.value === type
    );

    return option?.label || type;
  };

  const getSelectedCourse = (
    courseId = selectedCourseId
  ) => {
    if (!courseId) {
      return null;
    }

    return (
      activeCourses.find(
        (course) =>
          String(course.id) === String(courseId)
      ) || null
    );
  };

  const getSelectedCourseLabel = (
    courseId = selectedCourseId
  ) => {
    const course = getSelectedCourse(courseId);

    if (!course) {
      return t("renderForm.course.noCourse");
    }

    return `${course.code} · ${course.academicYear}-${course.academicTerm}`;
  };

  const buildExecutionDisplaySummary = (snapshot) => {
    if (!snapshot) return null;

    const recovered =
      snapshot.recoveredFromPersistence === true;
    const taskId =
      snapshot.taskId ||
      snapshot.recoveredTaskId ||
      "";
    const dataTypeId =
      snapshot.dataType ||
      snapshot.recoveredDataType ||
      "";
    const profileId =
      snapshot.executionProfileId ||
      snapshot.recoveredProfileId ||
      "";

    return {
      ...snapshot,
      testName: recovered
        ? snapshot.recoveredSubmissionTitle ||
          t("renderForm.page.recoveredExecution")
        : snapshot.testName,
      fileName:
        recovered &&
        Number(snapshot.recoveredFileCount) > 1
          ? t("renderForm.page.recoveredFiles", {
              count: Number(
                snapshot.recoveredFileCount
              ),
            })
          : snapshot.fileName,
      taskTitle: taskId
        ? getTaskTitle(taskId)
        : snapshot.taskTitle || "-",
      inputSizeLabel:
        taskId &&
        snapshot.inputSize !== null &&
        snapshot.inputSize !== undefined
          ? getInputSizeLabel(
              taskId,
              snapshot.inputSize
            )
          : snapshot.inputSizeLabel || "—",
      samplesLabel:
        snapshot.samples !== null &&
        snapshot.samples !== undefined
          ? getSamplesLabel(snapshot.samples)
          : snapshot.samplesLabel || "—",
      profileLabel: profileId
        ? getExecutionProfileLabel(profileId)
        : snapshot.profileLabel || "-",
      environmentLabel: recovered
        ? snapshot.recoveredHardwareProfile ||
          t("renderForm.page.registeredEnvironment")
        : snapshot.environmentLabel ||
          getEnvironmentLabel(),
      dataTypeLabel: dataTypeId
        ? getDataTypeLabel(dataTypeId)
        : t("renderForm.benchmark.notApplicable"),
      courseLabel: snapshot.courseId
        ? getSelectedCourseLabel(snapshot.courseId)
        : snapshot.courseLabel ||
          getSelectedCourseLabel(),
    };
  };


  const hasParamErrors = Boolean(
    paramErrors.inputSize || paramErrors.samples
  );
  const isSubmitDisabled =
    !file ||
    !selectedTaskType ||
    isSubmitting ||
    hasParamErrors ||
    !!fileError ||
    courseContextLoading ||
    !!courseContextError ||
    (courseSelectionRequired && !selectedCourseId) ||
    (selectedTaskType === "camm" && !dataType);

  const currentInputLimits = getLimits("inputSize");
  const currentSamplesLimits = getLimits("samples");

  const liveSummary = {
    testName,
    fileName: file ? file.name : "",
    taskTitle:
      selectedTaskType
        ? getTaskTitle()
        : "",
    inputSize,
    inputSizeLabel:
      selectedTaskType
        ? getInputSizeLabel()
        : "—",
    samples,
    samplesLabel:
      selectedTaskType
        ? getSamplesLabel()
        : "—",
    profileLabel: getExecutionProfileLabel(),
    environmentLabel: getEnvironmentLabel(),
    dataTypeLabel: getDataTypeLabel(),
    courseLabel: getSelectedCourseLabel(),
  };

  const executionDisplaySummary =
    buildExecutionDisplaySummary(
      executionSnapshot
    );

  const statusSummary =
    fileList.length > 0 ||
    isSubmitting ||
    submissionError
      ? executionDisplaySummary || liveSummary
      : liveSummary;

  const submissionErrorText =
    resolveMessageState(submissionError, t);
  const courseContextErrorText =
    resolveMessageState(courseContextError, t);
  const localizedParamErrors = {
    inputSize: resolveMessageState(
      paramErrors.inputSize,
      t
    ),
    samples: resolveMessageState(
      paramErrors.samples,
      t
    ),
  };

  return (
    <div className="rf-page inicio-container">
      {/* Header superior */}
      <HeaderSection
        title={t("renderForm.page.headerTitle")}
        subtitle={t("renderForm.page.headerSubtitle")}
      />

      <form onSubmit={handleOpenOverview}>
        {/* Encabezado de paso dentro del cuerpo */}
        <div className="rf-step-header">
          <span className="rf-step-kicker">
            {t("renderForm.page.configKicker")}
          </span>
          <h2 className="rf-step-title">
            {t("renderForm.page.configTitle")}
          </h2>
          <p className="rf-step-description">
            {t("renderForm.page.configDescription")}
          </p>
        </div>

        <div className="rf-main-layout">
          {/* =================== COLUMNA IZQUIERDA: CONFIGURACIÓN =================== */}
          <div className="rf-main-left">
            {/* CORE-07F-5: contexto académico */}
            <AcademicCourseCard
              courses={activeCourses}
              loading={courseContextLoading}
              error={courseContextErrorText}
              selectedCourseId={selectedCourseId}
              selectionRequired={courseSelectionRequired}
              onCourseChange={setSelectedCourseId}
              onRetry={() =>
                setCourseContextReloadToken(
                  (value) => value + 1
                )
              }
            />

            {/* Bloque: Nombre del test + upload de archivo */}
            <TestNameAndUploadCard
              testName={testName}
              onTestNameChange={handleTestNameChange}
              note={note}
              onNoteChange={setNote}
              fileMeta={fileMeta}
              fileError={fileError}
              isDraggingFile={isDraggingFile}
              isInspectingZip={isInspectingZip}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileInputChange={handleFileInputChange}
              fileInputRef={fileInputRef}
              maxZipMb={MAX_ZIP_MB}
            />

            {/* Bloque: Tipo de test + parámetros */}
            <TestTypeAndParamsCard
              tasks={tasks}
              selectedTaskType={selectedTaskType}
              onTaskChange={handleTaskChange}
              inputSize={inputSize}
              samples={samples}
              onInputSizeChange={handleInputSizeChange}
              onInputSizeSliderChange={handleInputSizeSliderChange}
              onSamplesChange={handleSamplesChange}
              onSamplesSliderChange={handleSamplesSliderChange}
              paramErrors={localizedParamErrors}
              inputSizePresets={inputSizePresets}
              samplesPresets={samplesPresets}
              numericalInputOptions={numericalInputOptionsUI}
              dataType={dataType}
              onDataTypeChange={handleDataTypeChange}
              taskDisplayNames={taskDisplayNames}
              taskSubtitles={taskSubtitles}
              taskDescriptions={taskDescriptions}
              taskIcons={taskIcons}
              taskBadges={taskBadges}
              inputSizeHelp={inputSizeHelp}
              paramLimits={PARAM_LIMITS}
              executionProfile={executionProfile}
            />

            {/* Bloque: Sistema de medición + perfil de ejecución */}
            <MeasurementAndProfileSection
              executionEnvironment={executionEnvironment}
              executionProfiles={executionProfiles}
              executionProfile={executionProfile}
              onExecutionProfileChange={handleExecutionProfileChange}
            />
          </div>

          {/* =================== PANEL DERECHO: ESTADO DEL CÓDIGO (SIEMPRE VISIBLE) =================== */}
          <StatusPanel
            fileList={fileList}
            messages={messages}
            executionFiles={executionFiles}
            isSubmitting={isSubmitting}
            allDone={allDone}
            allTerminal={allTerminal}
            hasError={hasError}
            submissionError={submissionErrorText}
            firstErrorMessage={firstErrorMessage}
            pollingRequestError={pollingRequestError}
            summary={statusSummary}
            isSubmitDisabled={isSubmitDisabled}
            onGoToResults={handleGoToResults}
            onReset={handleResetForm}
            onPrepareNewAnalysis={handlePrepareNewAnalysis}
            onPrepareRetry={handlePrepareRetry}
            onRetryPolling={retryPolling}
          />
        </div>

      </form>

      {/* =================== MODAL DE OVERVIEW =================== */}
      <OverviewModal
        visible={showOverview}
        onCancel={handleCancelOverview}
        onConfirm={handleConfirmExecution}
        isSubmitting={isSubmitting}
        testName={testName}
        fileName={file ? file.name : null}
        taskTitle={getTaskTitle()}
        taskId={selectedTaskType}
        inputSize={inputSize}
        inputLimits={currentInputLimits}
        samples={samples}
        sampleLimits={currentSamplesLimits}
        dataTypeLabel={getDataTypeLabel()}
        dataType={dataType}
        environmentLabel={getEnvironmentLabel()}
        executionProfileLabel={getExecutionProfileLabel()}
        executionProfileId={executionProfile}
        courseLabel={getSelectedCourseLabel()}
        hasCourse={Boolean(getSelectedCourse())}
        username={
          currentUser?.email ||
          currentUser?.username ||
          currentUser?.name ||
          ""
        }
      />
    </div>
  );
}

export default RenderFormPage;
