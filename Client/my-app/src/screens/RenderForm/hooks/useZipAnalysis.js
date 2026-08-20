// src/screens/RenderForm/hooks/useZipAnalysis.js
import { useState, useCallback } from "react";
import JSZip from "jszip";

import { useI18n } from "../../../i18n";

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

function useZipAnalysis() {
  const { t } = useI18n();
  const [file, setFile] = useState(null);
  const [fileErrorState, setFileErrorState] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isInspectingZip, setIsInspectingZip] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setFileErrorState(null);
    setFileMeta(null);
    setIsDraggingFile(false);
    setIsInspectingZip(false);
  }, []);

  const analyzeZipFile = useCallback(
    async (zipFile) => {
      reset();

      if (!zipFile) return false;

      if (!zipFile.name.toLowerCase().endsWith(".zip")) {
        setFile(null);
        setFileErrorState({
          key: "renderForm.workflow.zip.extension",
          params: {},
        });
        return false;
      }

      if (zipFile.size > MAX_ZIP_BYTES) {
        setFile(null);
        setFileErrorState({
          key: "renderForm.workflow.zip.tooLarge",
          params: {
            max: MAX_ZIP_MB,
            size: formatBytes(zipFile.size),
          },
        });
        return false;
      }

      setFile(zipFile);
      setIsInspectingZip(true);

      try {
        const arrayBuffer = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const cppFiles = [];
        zip.forEach((relativePath, entry) => {
          if (
            !entry.dir &&
            relativePath.toLowerCase().endsWith(".cpp")
          ) {
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
          setFileErrorState({
            key: "renderForm.workflow.zip.noCpp",
            params: {},
          });
        }

        return true;
      } catch (err) {
        console.error("Error al leer el .zip:", err);
        setFileErrorState({
          key: "renderForm.workflow.zip.unreadable",
          params: {},
        });
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
      const uploadedFile =
        event.target.files && event.target.files[0];
      const ok = await analyzeZipFile(uploadedFile);
      if (!ok) {
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

      await analyzeZipFile(droppedFiles[0]);
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

  const fileError = fileErrorState
    ? t(fileErrorState.key, fileErrorState.params)
    : "";

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
