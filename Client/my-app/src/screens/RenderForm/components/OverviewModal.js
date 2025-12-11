// src/screens/RenderForm/components/OverviewModal.js
import React from "react";

function OverviewModal({
  visible,
  onCancel,
  onConfirm,
  isSubmitting,
  testName,
  fileName,
  taskTitle,
  inputSize,
  inputLimits,
  samples,
  sampleLimits,
  dataTypeLabel,
  machineLabel,
  executionProfileLabel,
  username,
}) {
  if (!visible) return null;

  return (
    <div className="rf-modal-backdrop">
      <div className="rf-modal">
        <div className="rf-modal-header">
          <h3>Resumen del test</h3>
          <p>
            Revisa los datos principales antes de enviar el código a la máquina
            medidora.
          </p>
        </div>

        <div className="rf-modal-body">
          <div className="rf-modal-grid">
            <div className="rf-modal-section">
              <h4>Información general</h4>
              <dl>
                <dt>Nombre del test</dt>
                <dd>{testName || "(sin nombre)"}</dd>

                <dt>Archivo</dt>
                <dd>{fileName || "Ningún archivo seleccionado"}</dd>

                <dt>Tipo de test</dt>
                <dd>{taskTitle || "-"}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>Parámetros</h4>
              <dl>
                <dt>Tamaño máximo de entrada</dt>
                <dd>
                  {inputSize}
                  {inputLimits
                    ? ` (entre ${inputLimits.min} y ${inputLimits.max})`
                    : ""}
                </dd>

                <dt>Repeticiones por incremento</dt>
                <dd>
                  {samples}
                  {sampleLimits
                    ? ` (entre ${sampleLimits.min} y ${sampleLimits.max})`
                    : ""}
                </dd>

                <dt>Tipo de datos (CAMM)</dt>
                <dd>{dataTypeLabel}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>Entorno de medición</h4>
              <dl>
                <dt>Máquina</dt>
                <dd>{machineLabel}</dd>

                <dt>Perfil de ejecución</dt>
                <dd>{executionProfileLabel}</dd>

                <dt>Usuario</dt>
                <dd>{username}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="rf-modal-footer">
          <button
            type="button"
            className="rf-modal-secondary"
            onClick={onCancel}
          >
            Volver y editar
          </button>
          <button
            type="button"
            className="rf-modal-primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Ejecutando…" : "Confirmar y ejecutar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverviewModal;
