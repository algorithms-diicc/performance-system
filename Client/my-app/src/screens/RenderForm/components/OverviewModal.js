
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
  environmentLabel,
  executionProfileLabel,
  courseLabel,
  username,
}) {
  if (!visible) return null;

  return (
    <div className="rf-modal-backdrop">
      <div className="rf-modal">
        <div className="rf-modal-header">
          <h3>Revisar experimento</h3>
          <p>
            Confirma la configuración antes de enviar el código al entorno de
            ejecución.
          </p>
        </div>

        <div className="rf-modal-body">
          <div className="rf-modal-grid">
            <div className="rf-modal-section">
              <h4>Experimento</h4>

              <dl>
                <dt>Nombre</dt>
                <dd>{testName || "(sin nombre)"}</dd>

                <dt>Archivo</dt>
                <dd>
                  {fileName ||
                    "Ningún archivo seleccionado"}
                </dd>

                <dt>Benchmark</dt>
                <dd>{taskTitle || "-"}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>Parámetros</h4>

              <dl>
                <dt>Tamaño máximo</dt>
                <dd>
                  {inputSize}
                  {inputLimits
                    ? ` (rango ${inputLimits.min}–${inputLimits.max})`
                    : ""}
                </dd>

                <dt>Repeticiones por punto</dt>
                <dd>
                  {samples}
                  {sampleLimits
                    ? ` (rango ${sampleLimits.min}–${sampleLimits.max})`
                    : ""}
                </dd>

                <dt>Distribución de datos</dt>
                <dd>{dataTypeLabel}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>Medición</h4>

              <dl>
                <dt>Entorno</dt>
                <dd>{environmentLabel}</dd>

                <dt>Perfil</dt>
                <dd>{executionProfileLabel}</dd>

                <dt>Curso</dt>
                <dd>{courseLabel || "Sin curso asociado"}</dd>

                <dt>Usuario</dt>
                <dd>{username || "Sesión autenticada"}</dd>
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
            {isSubmitting
              ? "Enviando…"
              : "Confirmar y ejecutar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverviewModal;