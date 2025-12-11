// src/screens/RenderForm/components/TestNameAndUploadCard.js
import React from "react";

function TestNameAndUploadCard({
  testName,
  onTestNameChange,
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
  return (
    <div className="rf-row rf-row-two">
      {/* Panel: Nombre del test */}
      <section className="rf-panel">
        <label className="form-label">
          <span className="label-icon">🏷️</span>
          Nombre del test
        </label>
        <input
          type="text"
          value={testName}
          onChange={(e) => onTestNameChange(e.target.value)}
          className="form-input"
          placeholder="Ej: LCS optimizado, CAMM bloqueado, etc."
        />
        <p className="form-help-text">
          Este nombre se usará para identificar la ejecución en la vista de
          resultados.
        </p>
      </section>

      {/* Panel: Upload de archivo .zip */}
      <section className="rf-panel">
        <label className="form-label">
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
