import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { serverURL } from "../common/Constants";
import InlineState from "../components/InlineState";
import {
  SUBMISSION_AGGREGATE_LABELS,
  canOpenExecutionResult,
  deriveSubmissionAggregateState,
  sortSubmissionExecutions,
} from "./submissionOverviewModel";

import "./SubmissionOverviewPage.css";

const stateClassName = (state) =>
  `submission-overview__state submission-overview__state--${String(
    state || "UNKNOWN"
  ).toLowerCase()}`;

const errorStateFromRequest = (error) => {
  const status = error?.response?.status;

  if (!error?.response) return "network";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "error";
};

const SubmissionOverviewPage = () => {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [summary, setSummary] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(null);

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setRequestError(null);

    try {
      const encodedId = encodeURIComponent(
        String(submissionId || "")
      );

      const [
        detailResponse,
        executionsResponse,
      ] = await Promise.all([
        axios.get(
          `${serverURL}api/submissions/${encodedId}`,
          { withCredentials: true }
        ),
        axios.get(
          `${serverURL}api/submissions/${encodedId}/executions`,
          {
            withCredentials: true,
            params: {
              page: 1,
              page_size: 200,
            },
          }
        ),
      ]);

      setSubmission(
        detailResponse.data?.submission || null
      );
      setSummary(
        detailResponse.data?.summary || {}
      );
      setExecutions(
        Array.isArray(executionsResponse.data?.items)
          ? executionsResponse.data.items
          : []
      );
    } catch (error) {
      console.error(
        "Error cargando Submission overview:",
        error
      );
      setRequestError(error);
      setSubmission(null);
      setSummary(null);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const orderedExecutions = useMemo(
    () => sortSubmissionExecutions(executions),
    [executions]
  );

  const aggregateState = useMemo(
    () => deriveSubmissionAggregateState(summary || {}),
    [summary]
  );

  if (loading) {
    return (
      <main className="submission-overview">
        <InlineState
          type="loading"
          title="Cargando experimento"
          description="Consultando el estado de sus ejecuciones."
        />
      </main>
    );
  }

  if (requestError) {
    return (
      <main className="submission-overview">
        <InlineState
          type={errorStateFromRequest(requestError)}
          title="No fue posible cargar el experimento"
          description="Revisa tu sesión o vuelve a intentar la consulta."
          actionLabel="Reintentar"
          onAction={loadSubmission}
        />
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="submission-overview">
        <InlineState
          type="not-found"
          title="Experimento no disponible"
          description="No se encontró información para esta Submission."
        />
      </main>
    );
  }

  const courseLabel = submission.course
    ? `${submission.course.code || "Curso"} · ${
        submission.course.academicYear || "-"
      }-${submission.course.academicTerm || "-"}`
    : "Sin curso asociado";

  return (
    <main className="submission-overview">
      <section className="submission-overview__header">
        <div>
          <p className="submission-overview__eyebrow">
            Experimento #{submission.id}
          </p>
          <h1>
            {submission.title || "Experimento sin título"}
          </h1>
          <p className="submission-overview__course">
            {courseLabel}
          </p>
        </div>

        <div className={stateClassName(aggregateState)}>
          {
            SUBMISSION_AGGREGATE_LABELS[
              aggregateState
            ] || aggregateState
          }
        </div>
      </section>

      <section
        className="submission-overview__summary"
        aria-label="Resumen de ejecuciones"
      >
        <div>
          <strong>
            {summary?.executionsCount || 0}
          </strong>
          <span>Ejecuciones</span>
        </div>
        <div>
          <strong>
            {summary?.completedExecutions || 0}
          </strong>
          <span>Completadas</span>
        </div>
        <div>
          <strong>
            {summary?.failedExecutions || 0}
          </strong>
          <span>Con error</span>
        </div>
        <div>
          <strong>
            {summary?.cancelledExecutions || 0}
          </strong>
          <span>Canceladas</span>
        </div>
      </section>

      <section className="submission-overview__content">
        <div className="submission-overview__section-heading">
          <div>
            <h2>Implementaciones</h2>
            <p>
              Cada archivo C++ conserva su propia Execution y
              sus resultados independientes.
            </p>
          </div>

          <button
            type="button"
            className="submission-overview__secondary-action"
            onClick={loadSubmission}
          >
            Actualizar estados
          </button>
        </div>

        {orderedExecutions.length === 0 ? (
          <InlineState
            type="empty"
            title="Sin ejecuciones"
            description="Esta Submission todavía no registra ejecuciones."
          />
        ) : (
          <div className="submission-overview__list">
            {orderedExecutions.map((execution) => {
              const failure = execution.failure;
              const originalFilename =
                execution.originalFilename ||
                execution.codename ||
                "Archivo sin nombre";

              return (
                <article
                  className="submission-overview__execution"
                  key={
                    execution.executionId ||
                    execution.publicId ||
                    execution.codename
                  }
                >
                  <div className="submission-overview__execution-main">
                    <div>
                      <h3>{originalFilename}</h3>
                      <p className="submission-overview__codename">
                        {execution.codename}
                      </p>
                    </div>

                    <span
                      className={stateClassName(
                        execution.state
                      )}
                    >
                      {
                        execution.stateLabel ||
                        execution.statusLabel ||
                        execution.state ||
                        "Desconocido"
                      }
                    </span>
                  </div>

                  {execution.state === "FAILED" && (
                    <div className="submission-overview__failure">
                      <strong>
                        La ejecución no produjo resultados.
                      </strong>
                      <p>
                        {
                          failure?.message ||
                          failure?.code ||
                          "El backend no entregó más detalle del fallo."
                        }
                      </p>
                      {(failure?.stage || failure?.code) && (
                        <small>
                          {failure?.stage
                            ? `Etapa: ${failure.stage}`
                            : ""}
                          {failure?.stage && failure?.code
                            ? " · "
                            : ""}
                          {failure?.code
                            ? `Código: ${failure.code}`
                            : ""}
                        </small>
                      )}
                    </div>
                  )}

                  <div className="submission-overview__execution-footer">
                    <span>
                      {execution.resultAvailable
                        ? "Resultado disponible"
                        : "Sin resultado publicable"}
                    </span>

                    {canOpenExecutionResult(execution) && (
                      <button
                        type="button"
                        className="submission-overview__primary-action"
                        onClick={() =>
                          navigate(
                            `/code/${encodeURIComponent(
                              execution.codename
                            )}`
                          )
                        }
                      >
                        Ver resultado
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};

export default SubmissionOverviewPage;
