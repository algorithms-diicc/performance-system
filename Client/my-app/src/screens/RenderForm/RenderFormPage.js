// src/screens/RenderForm/RenderFormPage.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import HeaderSection from "./components/HeaderSection";
import TestNameAndUploadCard from "./components/TestNameAndUploadCard";
import TestTypeAndParamsCard from "./components/TestTypeAndParamsCard";
import MeasurementAndProfileSection from "./components/MeasurementAndProfileSection";
import StatusPanel from "./components/StatusPanel";
import OverviewModal from "./components/OverviewModal";

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
const RENDER_FORM_DRAFT_KEY = "renderFormDraft_v1";

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
 * Info de la máquina medidora
 */
const machineOptions = [
  {
    id: "medidora",
    name: "Máquina medidora principal",
    description: "CPU Intel i5-9400 · 23GB RAM · Linux Mint 22.",
  },
  {
    id: "local",
    name: "Ejecución local (mock)",
    description: "Solo para pruebas de interfaz. No registra métricas reales.",
    disabled: true,
  },
];

/**
 * Perfiles de ejecución
 */
const executionProfiles = [
  {
    id: "rapido",
    name: "Rápido",
    description: "Menos repeticiones, ideal para pruebas preliminares.",
  },
  {
    id: "equilibrado",
    name: "Equilibrado",
    description: "Buen balance entre tiempo y precisión de las métricas.",
  },
  {
    id: "exhaustivo",
    name: "Exhaustivo",
    description: "Más repeticiones para obtener mediciones más estables.",
  },
];

/**
 * Contrato oficial de perfiles: solo afecta "samples"
 */
const EXECUTION_PROFILE_SAMPLES = {
  rapido: 10,
  equilibrado: 30,
  exhaustivo: 50,
};

/**
 * Subtítulos cortos por tipo de test (solo UI)
 */
const taskSubtitles = {
  lcs: "Mide algoritmos sobre texto grande usando english.50MB.",
  camm: "Evalúa rendimiento con arreglos numéricos grandes.",
  size: "Prueba variando un parámetro entero de entrada.",
};

/**
 * Iconos por tipo de test
 */
const taskIcons = {
  lcs: "📝",
  camm: "🔢",
  size: "📏",
};

/**
 * Badges informativos por tipo de test
 */
const taskBadges = {
  lcs: "Texto · english.50MB",
  camm: "150.000 números",
  size: "Argumento entero",
};

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

function RenderFormPage() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // ======= Estado general del formulario =======
  const [testName, setTestName] = useState("");
  const [selectedTaskType, setSelectedTaskType] = useState("");
  const [inputSize, setInputSize] = useState(1000);
  const [samples, setSamples] = useState(30);
  const [samplesIsDirty, setSamplesIsDirty] = useState(false);
  const [paramErrors, setParamErrors] = useState({
    inputSize: "",
    samples: "",
  });

  const [dataType, setDataType] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("medidora");
  const [executionProfile, setExecutionProfile] = useState("equilibrado");

  const [fileList, setFileList] = useState([]);
  const [check, setCheck] = useState(true); // controla botón "Ver estadísticas"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

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

  // ======= Polling de estado para cada archivo (hook dedicado) =======
  const { messages, allDone } = useExecutionPolling(fileList);

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
        selectedTaskType: savedTaskType = "",
        inputSize: savedInputSize,
        samples: savedSamples,
        dataType: savedDataType = "",
        selectedMachine: savedMachine = "medidora",
        executionProfile: savedProfile = "equilibrado",
      } = draft;

      setTestName(savedTestName);
      setSelectedTaskType(savedTaskType || "");
      setDataType(savedDataType);
      setSelectedMachine(savedMachine);
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

      setSamplesIsDirty(false);
      setParamErrors({ inputSize: "", samples: "" });
    } catch (e) {
      console.error("Error al cargar configuración previa del test:", e);
    }
  }, []);

  // Cuando todos los archivos terminen, se detiene el “modo ejecutando”
  useEffect(() => {
    if (allDone && fileList.length > 0) {
      setCheck(false);
      setIsSubmitting(false);
    }
  }, [allDone, fileList.length]);

  // ======= Guardado automático de borrador en localStorage =======
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const draft = {
        version: 1,
        testName,
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
        selectedMachine,
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
    selectedTaskType,
    inputSize,
    samples,
    dataType,
    selectedMachine,
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

    let error = "";
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      error = "Ingresa un valor numérico.";
    } else {
      const num = Number(rawValue);
      if (Number.isNaN(num)) {
        error = "Ingresa un número válido.";
      } else if (num < limits.min) {
        error = `Mínimo permitido: ${limits.min}.`;
      } else if (num > limits.max) {
        error = `Máximo permitido: ${limits.max}.`;
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

  const handleInputSizeSliderChange = (e) => {
    const value = Number(e.target.value);
    setInputSize(value);
    validateParam("inputSize", value);
  };

  const handleSamplesChange = (e) => {
    const raw = e.target.value;
    const value = raw === "" ? "" : Number(raw);
    setSamples(value);
    setSamplesIsDirty(true);
    validateParam("samples", raw);
  };

  const handleSamplesSliderChange = (e) => {
    const value = Number(e.target.value);
    setSamples(value);
    setSamplesIsDirty(true);
    validateParam("samples", value);
  };

  // ======= Selección de tipo de test =======
  const handleTaskChange = (taskId) => {
    if (selectedTaskType !== taskId) {
      // Si cambio de tipo de test, reseteo dataType
      setDataType("");
    }

    setSelectedTaskType(taskId);

    const params = defaultParams[taskId];
    if (params) {
      setInputSize(params.inputSize);
      setSamples(params.samples);
      setSamplesIsDirty(false);
    }

    // Limpio errores al cambiar de test
    setParamErrors({
      inputSize: "",
      samples: "",
    });
  };

  const handleDataTypeChange = (type) => {
    setDataType(type);
  };

  // ======= Perfiles de ejecución ↔ parámetros =======
  const handleExecutionProfileChange = (profileId) => {
    setExecutionProfile(profileId);

    const suggestedSamples = EXECUTION_PROFILE_SAMPLES[profileId];
    const limits = getLimits("samples");

    // Solo aplicamos el valor sugerido si el usuario todavía no “ensució” samples
    if (!samplesIsDirty && typeof suggestedSamples === "number") {
      let newSamples = suggestedSamples;

      if (limits) {
        if (newSamples < limits.min) newSamples = limits.min;
        if (newSamples > limits.max) newSamples = limits.max;
      }

      setSamples(newSamples);
      validateParam("samples", newSamples);
      setSamplesIsDirty(false);
    }
  };

  // ======= Reset completo del formulario =======
  const handleResetForm = () => {
    setTestName("");
    setSelectedTaskType("");
    setInputSize(1000);
    setSamples(30);
    setSamplesIsDirty(false);
    setParamErrors({ inputSize: "", samples: "" });
    setDataType("");
    setSelectedMachine("medidora");
    setExecutionProfile("equilibrado");

    setFileList([]);
    setCheck(true);
    setIsSubmitting(false);
    setShowOverview(false);

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
      alert("Por favor, sube un archivo .zip antes de continuar.");
      return;
    }
    if (!selectedTaskType) {
      alert("Selecciona un tipo de test antes de ejecutar.");
      return;
    }
    if (fileError) {
      alert("Corrige el error del archivo antes de ejecutar.");
      return;
    }
    if (paramErrors.inputSize || paramErrors.samples) {
      alert("Corrige los parámetros numéricos antes de ejecutar.");
      return;
    }
    if (selectedTaskType === "camm" && !dataType) {
      alert("Selecciona el tipo de datos para CAMM antes de ejecutar.");
      return;
    }

    setShowOverview(true);
  };

  const handleConfirmExecution = () => {
    if (!file || !selectedTaskType) return;

    const bodyFormData = new FormData();
    bodyFormData.append("file", file, file.name);

    const safeInputSize =
      typeof inputSize === "number" ? inputSize : Number(inputSize) || 0;
    const safeSamples =
      typeof samples === "number" ? samples : Number(samples) || 0;

    bodyFormData.append("input_size", safeInputSize);
    bodyFormData.append("samples", safeSamples);

    if (selectedTaskType) {
      bodyFormData.append("task_type", getTask(selectedTaskType));
    }
    if (dataType) {
      bodyFormData.append("data_type", dataType);
    }
    if (testName) {
      bodyFormData.append("test_name", testName);
    }
    bodyFormData.append("machine_profile", selectedMachine);
    bodyFormData.append("execution_profile", executionProfile);

    // TODO: cuando tengas auth real, reemplazar por el email del usuario logueado
    bodyFormData.append("username", "admin@inf.udec.cl (mock)");

    setIsSubmitting(true);
    setCheck(true);
    setFileList([]);
    setShowOverview(false);

    axios({
      method: "post",
      url: baseURL,
      data: bodyFormData,
      headers: { "Content-Type": "multipart/form-data" },
    })
      .then((response) => {
        const queuedFiles = response.data.cpp_files_queued;
        if (queuedFiles && queuedFiles.length > 0 && queuedFiles[0].length > 0) {
          setFileList(queuedFiles);
        } else {
          console.error("No se encontraron archivos en la respuesta del backend.");
          setIsSubmitting(false);
        }
      })
      .catch((error) => {
        console.error("❌ Error al enviar archivo:", error);
        setIsSubmitting(false);
      });
  };

  const handleCancelOverview = () => {
    setShowOverview(false);
  };

  const handleGoToResults = () => {
    if (!fileList || fileList.length === 0) return;

    const lastCode = fileList[fileList.length - 1];
    navigate("/code/" + lastCode, {
      replace: false,
      state: { name: testName || lastCode, codeList: fileList },
    });
  };

  // ======= Estado global (chip) del panel derecho =======
  const getGlobalStatusChip = () => {
    // Si no hay nada en ejecución y no estamos enviando, no mostramos chip
    if (!fileList.length && !isSubmitting) {
      return null;
    }

    let hasTimeout = false;
    let hasCompileError = false;
    let hasError = false;

    messages.forEach((group) => {
      (group.messages || []).forEach((m) => {
        const text = (m.msg || "").toLowerCase();
        if (text.includes("timeout") || text.includes("tiempo límite excedido")) {
          hasTimeout = true;
        } else if (
          text.includes("compilación") ||
          text.includes("compilation") ||
          text.includes("error de compilación")
        ) {
          hasCompileError = true;
        } else if (text.includes("error") || text.includes("❌")) {
          hasError = true;
        }
      });
    });

    if (hasTimeout) {
      return {
        label: "Timeout / ejecución muy lenta",
        className: "status-chip status-chip-error",
      };
    }

    if (hasCompileError) {
      return {
        label: "Error de compilación",
        className: "status-chip status-chip-error",
      };
    }

    if (hasError) {
      return {
        label: "Error detectado",
        className: "status-chip status-chip-error",
      };
    }

    if (!check && fileList.length > 0) {
      return {
        label: "Resultados listos",
        className: "status-chip status-chip-done",
      };
    }

    if (isSubmitting || fileList.length > 0) {
      return {
        label: "Ejecutando…",
        className: "status-chip status-chip-running",
      };
    }

    return null;
  };

  const statusChip = getGlobalStatusChip();

  // ======= Utilitarios para el modal =======
  const getTaskTitle = () => {
    const t = tasks.find((task) => task.id === selectedTaskType);
    return t ? t.title : "-";
  };

  const getMachineLabel = () => {
    const m = machineOptions.find((opt) => opt.id === selectedMachine);
    return m ? m.name : "-";
  };

  const getExecutionProfileLabel = () => {
    const p = executionProfiles.find((opt) => opt.id === executionProfile);
    return p ? p.name : "-";
  };

  const getDataTypeLabel = () => {
    if (!dataType) return "No aplica";
    const opt = numericalInputOptions.find((o) => o.value === dataType);
    return opt ? opt.label : dataType;
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
    (selectedTaskType === "camm" && !dataType);

  const currentInputLimits = getLimits("inputSize");
  const currentSamplesLimits = getLimits("samples");

  return (
    <div className="inicio-container">
      {/* Header superior */}
      <HeaderSection
        title="Configurar experimento de rendimiento"
        subtitle="Sube tu código y define cómo se medirá su rendimiento."
      />

      <form onSubmit={handleOpenOverview}>
        {/* Encabezado de paso dentro del cuerpo */}
        <div className="rf-step-header">
          <span className="rf-step-kicker">Paso 1</span>
          <h2 className="rf-step-title">Preparar ejecución</h2>
          <p className="rf-step-description">
            Sube el código en formato <code>.zip</code>, selecciona el tipo de
            test y ajusta los parámetros principales.
          </p>
        </div>

        <div className="rf-main-layout">
          {/* =================== COLUMNA IZQUIERDA: CONFIGURACIÓN =================== */}
          <div className="rf-main-left">
            {/* Bloque: Nombre del test + upload de archivo */}
            <TestNameAndUploadCard
              testName={testName}
              onTestNameChange={setTestName}
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
              paramErrors={paramErrors}
              inputSizePresets={inputSizePresets}
              samplesPresets={samplesPresets}
              numericalInputOptions={numericalInputOptions}
              dataType={dataType}
              onDataTypeChange={handleDataTypeChange}
              taskSubtitles={taskSubtitles}
              taskIcons={taskIcons}
              taskBadges={taskBadges}
              paramLimits={PARAM_LIMITS}
            />

            {/* Bloque: Sistema de medición + perfil de ejecución */}
            <MeasurementAndProfileSection
              machineOptions={machineOptions}
              selectedMachine={selectedMachine}
              onMachineChange={setSelectedMachine}
              executionProfiles={executionProfiles}
              executionProfile={executionProfile}
              onExecutionProfileChange={handleExecutionProfileChange}
            />
          </div>

          {/* =================== PANEL DERECHO: ESTADO DEL CÓDIGO (SIEMPRE VISIBLE) =================== */}
          <StatusPanel
            fileList={fileList}
            messages={messages}
            statusChip={statusChip}
            check={check}
            onGoToResults={handleGoToResults}
          />
        </div>

        {/* Barra inferior de acciones */}
        <div className="rf-footer-bar">
          <button
            type="button"
            className="secondary-button"
            onClick={handleResetForm}
          >
            Resetear formulario
          </button>

          <button
            type="submit"
            className={`submit-button ${
              isSubmitDisabled ? "disabled" : ""
            }`}
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? "Ejecutando test..." : "Revisar y ejecutar"}
          </button>

          <p className="run-hint">
            Se mostrará un resumen con los parámetros seleccionados antes de
            ejecutar el test en la máquina medidora.
          </p>
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
        inputSize={inputSize}
        inputLimits={currentInputLimits}
        samples={samples}
        sampleLimits={currentSamplesLimits}
        dataTypeLabel={getDataTypeLabel()}
        machineLabel={getMachineLabel()}
        executionProfileLabel={getExecutionProfileLabel()}
        username="admin@inf.udec.cl (mock)"
      />
    </div>
  );
}

export default RenderFormPage;
