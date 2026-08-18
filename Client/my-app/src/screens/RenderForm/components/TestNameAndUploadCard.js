// src/screens/RenderForm/components/TestNameAndUploadCard.js
import React from "react";
import {
  MAX_SUBMISSION_NOTE_CHARS,
  MAX_SUBMISSION_TITLE_CHARS,
} from "../formOnboardingModel";

function TestNameAndUploadCard({
  testName,
  onTestNameChange,
  note,
  onNoteChange,
  fileMeta,
  fileError,
  isDraggingFile,
  isInspectingZip,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileInputChange,
  fileInputRef,
  maxZipMb,
}) {
  const noteLength = String(note || "").length;

  const handleDropzoneKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInputRef.current?.click();
  };

  return (
    <div className="rf-row rf-row-two">
      {/* Panel: Nombre del test */}
      <section className="rf-panel">
        <label className="form-label" htmlFor="rf-test-name">
          <span className="label-icon">🏷️</span>
          Nombre del test
        </label>
        <input
          id="rf-test-name"
          type="text"
          aria-label="Nombre del test"
          value={testName}
          onChange={(e) => onTestNameChange(e.target.value)}
          maxLength={MAX_SUBMISSION_TITLE_CHARS}
          className="form-input"
          placeholder="Ej: LCS optimizado, CAMM bloqueado, etc."
        />
        <p className="form-help-text">
          Este nombre se usará para identificar la ejecución en la vista de
          resultados.
        </p>

        <div className="rf-note-field">
          <label className="form-label" htmlFor="rf-submission-note">
            <span className="label-icon">🗒️</span>
            Nota personal
            <span className="rf-note-optional">(opcional)</span>
          </label>
          <textarea
            id="rf-submission-note"
            className="form-input rf-note-textarea"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={MAX_SUBMISSION_NOTE_CHARS}
            aria-describedby="rf-submission-note-help rf-submission-note-counter"
          />
          <div className="rf-note-meta">
            <p
              id="rf-submission-note-help"
              className="form-help-text"
            >
              Solo tú podrás ver esta nota.
            </p>
            <span
              id="rf-submission-note-counter"
              className="rf-note-counter"
              aria-live="polite"
            >
              {noteLength} / {MAX_SUBMISSION_NOTE_CHARS} caracteres
            </span>
          </div>
        </div>
      </section>

      {/* Panel: Upload de archivo .zip */}
      <section className="rf-panel">
        <label className="form-label" htmlFor="rf-code-archive">
          <span className="label-icon">📁</span>
          Archivo de código (.zip)
        </label>

        <div
          className={`file-upload-dropzone ${
            isDraggingFile ? "dragging" : ""
          } ${fileError ? "has-error" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar archivo de código ZIP"
        >
          <div className="file-upload-content">
            <div className="file-upload-icon">⬆️</div>
            <div className="file-upload-text">
              <span className="file-upload-title">
                Arrastra y suelta el .zip aquí
              </span>
              <span className="file-upload-hint">
                o haz clic para seleccionar un archivo desde tu equipo.
              </span>
              <span className="file-upload-hint">
                Máx recomendado: {maxZipMb} MB. El .zip debe contener al
                menos un archivo <code>.cpp</code>.
              </span>
            </div>
          </div>

          {fileMeta && (
            <div className="file-meta">
              <div className="file-meta-name">{fileMeta.name}</div>
              <div className="file-meta-extra">
                <span>{fileMeta.sizeLabel}</span>
                {isInspectingZip && <span>· Analizando contenido…</span>}
                {!isInspectingZip && (
                  <span>
                    · {fileMeta.cppCount} archivo
                    {fileMeta.cppCount === 1 ? "" : "s"} .cpp
                  </span>
                )}
              </div>
              {!isInspectingZip &&
                fileMeta.cppSample &&
                fileMeta.cppSample.length > 0 && (
                  <div className="file-meta-extra">
                    <span>Ejemplos dentro del .zip:</span>
                    <span>
                      {fileMeta.cppSample.join(" · ")}
                      {fileMeta.cppCount > fileMeta.cppSample.length
                        ? " · …"
                        : ""}
                    </span>
                  </div>
                )}
            </div>
          )}

          <input
            id="rf-code-archive"
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={onFileInputChange}
            className="file-input-hidden"
          />
        </div>

        {fileError && (
          <p className="form-error-text">
            {fileError}
          </p>
        )}
      </section>
    </div>
  );
}

export default TestNameAndUploadCard;
