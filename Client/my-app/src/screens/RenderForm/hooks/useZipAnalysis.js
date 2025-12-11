// src/screens/RenderForm/hooks/useZipAnalysis.js
import { useState, useCallback } from "react";
import JSZip from "jszip";

/**
 * Límite de tamaño del .zip en MB.
 * 👉 Si en el futuro necesitas cambiarlo, basta con modificar este valor.
 */
const MAX_ZIP_MB = 500;
const MAX_ZIP_BYTES = MAX_ZIP_MB * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Hook responsable de:
 * - Validar extensión (.zip)
 * - Validar tamaño máximo
 * - Inspeccionar contenido con JSZip y contar .cpp
 * - Exponer handlers para input file + drag & drop
 * - Exponer reset() para limpiar el estado del archivo
 */
function useZipAnalysis() {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [fileMeta, setFileMeta] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isInspectingZip, setIsInspectingZip] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setFileError("");
    setFileMeta(null);
    setIsDraggingFile(false);
    setIsInspectingZip(false);
  }, []);

  const analyzeZipFile = useCallback(
    async (zipFile) => {
      // limpiamos cualquier estado previo
      reset();

      if (!zipFile) return false;

      // Extensión
      if (!zipFile.name.toLowerCase().endsWith(".zip")) {
        setFile(null);
        setFileError("El archivo debe tener extensión .zip.");
        return false;
      }

      // Tamaño
      if (zipFile.size > MAX_ZIP_BYTES) {
        setFile(null);
        setFileError(
          `El tamaño máximo recomendado es de ${MAX_ZIP_MB} MB. El archivo actual pesa ${formatBytes(
            zipFile.size
          )}.`
        );
        return false;
      }

      setFile(zipFile);
      setIsInspectingZip(true);

      try {
        const arrayBuffer = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const cppFiles = [];
        zip.forEach((relativePath, entry) => {
          if (!entry.dir && relativePath.toLowerCase().endsWith(".cpp")) {
            cppFiles.push(relativePath);
          }
        });

        setFileMeta({
          name: zipFile.name,
          sizeBytes: zipFile.size,
          sizeLabel: formatBytes(zipFile.size),
          cppCount: cppFiles.length,
          cppSample: cppFiles.slice(0, 5),
        });

        if (cppFiles.length === 0) {
          setFileError(
            "El .zip no contiene archivos .cpp. Revisa el contenido antes de volver a subirlo."
          );
        }

        return true;
      } catch (err) {
        console.error("Error al leer el .zip:", err);
        setFileError(
          "No se pudo leer el contenido del .zip. Inténtalo nuevamente o con otro archivo."
        );
        setFile(null);
        setFileMeta(null);
        return false;
      } finally {
        setIsInspectingZip(false);
      }
    },
    [reset]
  );

  const handleFileInputChange = useCallback(
    async (event) => {
      const uploadedFile = event.target.files && event.target.files[0];
      const ok = await analyzeZipFile(uploadedFile);
      if (!ok) {
        // Permite volver a seleccionar el mismo archivo
        event.target.value = "";
      }
    },
    [analyzeZipFile]
  );

  const handleDrop = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingFile(false);

      const droppedFiles = event.dataTransfer.files;
      if (!droppedFiles || droppedFiles.length === 0) return;

      const zipFile = droppedFiles[0];
      await analyzeZipFile(zipFile);
    },
    [analyzeZipFile]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
  }, []);

  return {
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
    reset,
  };
}

export default useZipAnalysis;
export { MAX_ZIP_MB };
