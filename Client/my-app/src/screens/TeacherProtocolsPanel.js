import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import InlineState from "../components/InlineState";
import { useI18n } from "../i18n";
import {
  teacherApi,
  teacherRequestErrorMessage,
} from "./teacherApi";
import {
  buildMeasurementPolicyMatrix,
  resolveMeasurementPolicy,
} from "./RenderForm/measurementPolicyModel";

import "./TeacherProtocolsPanel.css";

const BASE_EMPTY_FORM = {
  title: "",
  objective: "",
  instructions: "",
  benchmark: "LCS",
  inputSize: "",
  executionProfile: "rapido",
  samples: 10,
  dataType: "",
};

function taskIdFromBenchmark(benchmark) {
  const normalized =
    String(benchmark || "")
      .trim()
      .toLowerCase();

  return ["lcs", "camm", "size"].includes(
    normalized
  )
    ? normalized
    : "";
}

function policyForForm(
  matrix,
  benchmark,
  executionProfile
) {
  return resolveMeasurementPolicy(
    matrix,
    taskIdFromBenchmark(benchmark),
    executionProfile
  );
}

function emptyFormFromPolicy(matrix) {
  const policy = policyForForm(
    matrix,
    "LCS",
    "rapido"
  );

  return {
    ...BASE_EMPTY_FORM,
    inputSize:
      policy?.defaultInput ?? "",
  };
}

function profileSamples(profile, current) {
  if (profile === "rapido") return 10;
  if (profile === "equilibrado") return 30;
  if (profile === "exhaustivo") return 50;
  return current;
}

function formFromProtocol(protocol) {
  return {
    title: protocol?.title || "",
    objective: protocol?.objective || "",
    instructions: protocol?.instructions || "",
    benchmark: protocol?.benchmark || "LCS",
    inputSize: protocol?.inputSize ?? "",
    executionProfile: protocol?.executionProfile || "rapido",
    samples: protocol?.samples ?? 10,
    dataType: protocol?.dataType || "",
  };
}

function protocolStateLabel(protocol, t) {
  if (!protocol?.isActive) return t("protocols.states.inactive");
  if (protocol?.isPublished) return t("protocols.states.published");
  return t("protocols.states.draft");
}

export default function TeacherProtocolsPanel({
  courseId,
  courseActive,
}) {
  const { t } = useI18n();
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(BASE_EMPTY_FORM);
  const [
    measurementPolicyMatrix,
    setMeasurementPolicyMatrix,
  ] = useState(null);
  const [
    measurementPolicyLoading,
    setMeasurementPolicyLoading,
  ] = useState(true);
  const [
    measurementPolicyError,
    setMeasurementPolicyError,
  ] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadProtocols = useCallback(async (signal) => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await teacherApi(
        `/api/teacher/courses/${courseId}/protocols`,
        { signal }
      );
      setProtocols(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setProtocols([]);
      setLoadError(error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [courseId]);

  const loadMeasurementPolicies =
    useCallback(async (signal) => {
      try {
        setMeasurementPolicyLoading(
          true
        );
        setMeasurementPolicyError(
          null
        );

        const data = await teacherApi(
          "/api/measurement/policies",
          { signal }
        );

        const matrix =
          buildMeasurementPolicyMatrix(
            data
          );

        if (!matrix) {
          const invalidPolicyError =
            new Error(
              "Invalid AUTO measurement policy matrix"
            );
          invalidPolicyError.code =
            "MEASUREMENT_POLICY_UNAVAILABLE";
          throw invalidPolicyError;
        }

        setMeasurementPolicyMatrix(
          matrix
        );
      } catch (error) {
        if (
          error?.name === "AbortError"
        ) {
          return;
        }

        setMeasurementPolicyMatrix(
          null
        );
        setMeasurementPolicyError(
          error
        );
      } finally {
        if (!signal?.aborted) {
          setMeasurementPolicyLoading(
            false
          );
        }
      }
    }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadProtocols(controller.signal);
    return () => controller.abort();
  }, [loadProtocols, reloadToken]);

  useEffect(() => {
    const controller =
      new AbortController();

    loadMeasurementPolicies(
      controller.signal
    );

    return () =>
      controller.abort();
  }, [
    loadMeasurementPolicies,
  ]);

  const loadErrorMessage = useMemo(
    () => loadError
      ? teacherRequestErrorMessage(loadError, t, {
          fallbackKey: "protocols.teacher.errors.load",
        })
      : "",
    [loadError, t]
  );

  const measurementPolicyErrorMessage =
    useMemo(
      () =>
        measurementPolicyError
          ? teacherRequestErrorMessage(
              measurementPolicyError,
              t,
              {
                fallbackKey:
                  "protocols.teacher.errors.policy",
                codeKeys: {
                  MEASUREMENT_POLICY_UNAVAILABLE:
                    "protocols.teacher.errors.policy",
                },
                statusKeys: {
                  503:
                    "protocols.teacher.errors.policy",
                },
              }
            )
          : "",
      [
        measurementPolicyError,
        t,
      ]
    );

  const formErrorMessage = useMemo(
    () => formError
      ? teacherRequestErrorMessage(formError, t, {
          fallbackKey: "protocols.teacher.errors.save",
        })
      : "",
    [formError, t]
  );

  const actionErrorMessage = useMemo(
    () => actionError
      ? teacherRequestErrorMessage(actionError, t, {
          fallbackKey: "protocols.teacher.errors.action",
        })
      : "",
    [actionError, t]
  );

  const openCreate = () => {
    if (!measurementPolicyMatrix) {
      return;
    }

    setEditingId(null);
    setForm(
      emptyFormFromPolicy(
        measurementPolicyMatrix
      )
    );
    setFormError(null);
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (protocol) => {
    setEditingId(protocol.id);
    setForm(formFromProtocol(protocol));
    setFormError(null);
    setActionError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(BASE_EMPTY_FORM);
    setFormError(null);
  };

  const changeForm = (field, value) => {
    setForm((previous) => {
      if (field === "executionProfile") {
        const nextPolicy =
          policyForForm(
            measurementPolicyMatrix,
            previous.benchmark,
            value
          );

        const numericInput =
          Number(previous.inputSize);

        const inputSize =
          nextPolicy
          && (
            !Number.isFinite(
              numericInput
            )
            || numericInput
              < nextPolicy.minimumInput
            || numericInput
              > nextPolicy.hardMaxInput
          )
            ? nextPolicy.defaultInput
            : previous.inputSize;

        return {
          ...previous,
          executionProfile: value,
          samples:
            profileSamples(
              value,
              previous.samples
            ),
          inputSize,
        };
      }

      if (field === "benchmark") {
        const nextPolicy =
          policyForForm(
            measurementPolicyMatrix,
            value,
            previous.executionProfile
          );

        return {
          ...previous,
          benchmark: value,
          inputSize:
            nextPolicy?.defaultInput
            ?? "",
          dataType:
            value === "CAMM"
              ? (
                  previous.dataType
                  || "cammr"
                )
              : "",
        };
      }
      return { ...previous, [field]: value };
    });
  };

  const saveProtocol = async (event) => {
    event.preventDefault();

    const payload = {
      title: form.title.trim(),
      objective: form.objective.trim(),
      instructions: form.instructions.trim(),
      benchmark: form.benchmark,
      inputSize: Number(form.inputSize),
      executionProfile: form.executionProfile,
      samples: Number(form.samples),
      dataType: form.benchmark === "CAMM" ? form.dataType : null,
    };

    try {
      setSaving(true);
      setFormError(null);
      const url = editingId
        ? `/api/teacher/courses/${courseId}/protocols/${editingId}`
        : `/api/teacher/courses/${courseId}/protocols`;

      await teacherApi(url, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      setFormOpen(false);
      setEditingId(null);
      setForm(BASE_EMPTY_FORM);
      setReloadToken((value) => value + 1);
    } catch (error) {
      setFormError(error);
    } finally {
      setSaving(false);
    }
  };

  const currentMeasurementPolicy =
    useMemo(
      () =>
        policyForForm(
          measurementPolicyMatrix,
          form.benchmark,
          form.executionProfile
        ),
      [
        measurementPolicyMatrix,
        form.benchmark,
        form.executionProfile,
      ]
    );

  const numericInputSize =
    Number(form.inputSize);

  const inputSizeWithinPolicy =
    Boolean(
      currentMeasurementPolicy
    )
    && Number.isFinite(
      numericInputSize
    )
    && numericInputSize
      >= currentMeasurementPolicy.minimumInput
    && numericInputSize
      <= currentMeasurementPolicy.hardMaxInput;

  const runAction = async (protocol, action) => {
    try {
      setActionId(protocol.id);
      setActionError(null);
      await teacherApi(
        `/api/teacher/courses/${courseId}/protocols/${protocol.id}/${action}`,
        { method: "POST" }
      );
      setReloadToken((value) => value + 1);
    } catch (error) {
      setActionError(error);
    } finally {
      setActionId(null);
    }
  };

  return (
    <section
      className="teacher-panel teacher-protocols-panel"
      aria-labelledby="teacher-protocols-title"
    >
      <div className="teacher-panel-heading">
        <div>
          <h2 id="teacher-protocols-title">
            {t("protocols.teacher.title")}
          </h2>
          <p>{t("protocols.teacher.description")}</p>
        </div>

        <button
          type="button"
          className="btn teacher-primary-button"
          disabled={
            !courseActive
            || saving
            || measurementPolicyLoading
            || !measurementPolicyMatrix
          }
          title={
            courseActive
              ? ""
              : t("protocols.teacher.courseInactive")
          }
          onClick={formOpen && !editingId ? closeForm : openCreate}
        >
          {formOpen && !editingId
            ? t("protocols.actions.close")
            : t("protocols.actions.create")}
        </button>
      </div>

      {measurementPolicyLoading && (
        <p
          className="teacher-protocols-note"
          role="status"
        >
          {t(
            "protocols.teacher.policyLoading"
          )}
        </p>
      )}

      {measurementPolicyErrorMessage && (
        <p
          className="teacher-protocols-note"
          role="alert"
        >
          {measurementPolicyErrorMessage}
        </p>
      )}

      {!courseActive && (
        <p className="teacher-protocols-note" role="note">
          {t("protocols.teacher.courseInactive")}
        </p>
      )}

      {formOpen && (
        <form className="teacher-protocol-form" onSubmit={saveProtocol}>
          <div className="teacher-protocol-form-heading">
            <strong>
              {editingId
                ? t("protocols.teacher.editTitle")
                : t("protocols.teacher.createTitle")}
            </strong>
            {editingId && (
              <button
                type="button"
                className="btn teacher-secondary-button"
                disabled={saving}
                onClick={closeForm}
              >
                {t("protocols.actions.close")}
              </button>
            )}
          </div>

          <div className="teacher-protocol-form-grid">
            <label className="teacher-protocol-field teacher-protocol-span-2">
              <span>{t("protocols.fields.title")}</span>
              <input
                className="form-control"
                value={form.title}
                maxLength="150"
                onChange={(event) =>
                  changeForm("title", event.target.value)
                }
                required
              />
            </label>

            <label className="teacher-protocol-field teacher-protocol-span-2">
              <span>{t("protocols.fields.objective")}</span>
              <textarea
                className="form-control"
                rows="3"
                value={form.objective}
                maxLength="2000"
                onChange={(event) =>
                  changeForm("objective", event.target.value)
                }
                required
              />
            </label>

            <label className="teacher-protocol-field teacher-protocol-span-2">
              <span>
                {t("protocols.fields.instructions")}{" "}
                <small>{t("protocols.fields.optional")}</small>
              </span>
              <textarea
                className="form-control"
                rows="3"
                value={form.instructions}
                maxLength="5000"
                onChange={(event) =>
                  changeForm("instructions", event.target.value)
                }
              />
            </label>

            <label className="teacher-protocol-field">
              <span>{t("protocols.fields.benchmark")}</span>
              <select
                className="form-select"
                value={form.benchmark}
                onChange={(event) =>
                  changeForm("benchmark", event.target.value)
                }
              >
                <option value="LCS">LCS</option>
                <option value="CAMM">CAMM</option>
                <option value="SIZE">SIZE</option>
              </select>
            </label>

            <label className="teacher-protocol-field">
              <span>{t("protocols.fields.inputSize")}</span>
              <input
                className="form-control"
                type="number"
                min={
                  currentMeasurementPolicy
                    ?.minimumInput
                  ?? 1
                }
                max={
                  currentMeasurementPolicy
                    ?.hardMaxInput
                }
                step={
                  currentMeasurementPolicy
                    ?.inputStep
                  ?? 1
                }
                value={form.inputSize}
                onChange={(event) =>
                  changeForm("inputSize", event.target.value)
                }
                required
              />
            </label>

            {currentMeasurementPolicy && (
              <p
                className="teacher-protocols-note teacher-protocol-span-2"
                role="note"
              >
                {t(
                  "protocols.teacher.policyLimits",
                  {
                    min:
                      currentMeasurementPolicy.minimumInput,
                    defaultValue:
                      currentMeasurementPolicy.defaultInput,
                    recommended:
                      currentMeasurementPolicy.recommendedMaxInput,
                    max:
                      currentMeasurementPolicy.hardMaxInput,
                  }
                )}
              </p>
            )}

            <label className="teacher-protocol-field">
              <span>{t("protocols.fields.profile")}</span>
              <select
                className="form-select"
                value={form.executionProfile}
                onChange={(event) =>
                  changeForm("executionProfile", event.target.value)
                }
              >
                <option value="rapido">{t("protocols.profiles.quick")}</option>
                <option value="equilibrado">{t("protocols.profiles.balanced")}</option>
                <option value="exhaustivo">{t("protocols.profiles.exhaustive")}</option>
                <option value="personalizado">{t("protocols.profiles.custom")}</option>
              </select>
            </label>

            <label className="teacher-protocol-field">
              <span>{t("protocols.fields.samples")}</span>
              <input
                className="form-control"
                type="number"
                min="1"
                max="100"
                value={form.samples}
                disabled={form.executionProfile !== "personalizado"}
                onChange={(event) =>
                  changeForm("samples", event.target.value)
                }
                required
              />
            </label>

            {form.benchmark === "CAMM" && (
              <label className="teacher-protocol-field teacher-protocol-span-2">
                <span>{t("protocols.fields.distribution")}</span>
                <select
                  className="form-select"
                  value={form.dataType}
                  onChange={(event) =>
                    changeForm("dataType", event.target.value)
                  }
                  required
                >
                  <option value="cammr">CAMMR</option>
                  <option value="cammso">CAMMSO</option>
                  <option value="camms">CAMMS</option>
                </select>
              </label>
            )}
          </div>

          {formErrorMessage && (
            <div className="teacher-inline-error" role="alert">
              {formErrorMessage}
            </div>
          )}

          <div className="teacher-form-actions">
            <button
              type="submit"
              className="btn teacher-primary-button"
              disabled={
                saving
                || !inputSizeWithinPolicy
              }
            >
              {saving
                ? t("protocols.actions.saving")
                : t("protocols.actions.save")}
            </button>
          </div>
        </form>
      )}

      {actionErrorMessage && (
        <div className="teacher-inline-error" role="alert">
          {actionErrorMessage}
        </div>
      )}

      {loading ? (
        <InlineState
          type="loading"
          title={t("protocols.teacher.loading")}
          compact
        />
      ) : loadError ? (
        <InlineState
          type="error"
          title={t("protocols.teacher.loadErrorTitle")}
          description={loadErrorMessage}
          actionLabel={t("protocols.actions.retry")}
          onAction={() => setReloadToken((value) => value + 1)}
          compact
        />
      ) : protocols.length === 0 ? (
        <div className="teacher-protocols-empty">
          <strong>{t("protocols.teacher.emptyTitle")}</strong>
          <p>{t("protocols.teacher.emptyText")}</p>
        </div>
      ) : (
        <div
          className="teacher-protocol-list"
          aria-label={t("protocols.teacher.listAria")}
        >
          {protocols.map((protocol) => (
            <article
              key={protocol.id}
              className="teacher-protocol-card"
            >
              <div className="teacher-protocol-card-header">
                <div>
                  <span
                    className={
                      `teacher-protocol-state teacher-protocol-state--${String(
                        protocol.state || ""
                      ).toLowerCase()}`
                    }
                  >
                    {protocolStateLabel(protocol, t)}
                  </span>
                  <h3>{protocol.title}</h3>
                </div>

                <div className="teacher-protocol-actions">
                  <button
                    type="button"
                    className="btn teacher-secondary-button"
                    disabled={actionId === protocol.id}
                    onClick={() => openEdit(protocol)}
                  >
                    {t("protocols.actions.edit")}
                  </button>

                  {!protocol.isPublished && (
                    <button
                      type="button"
                      className="btn teacher-primary-button"
                      disabled={
                        !courseActive || actionId === protocol.id
                      }
                      onClick={() => runAction(protocol, "publish")}
                    >
                      {t("protocols.actions.publish")}
                    </button>
                  )}

                  {protocol.isActive && (
                    <button
                      type="button"
                      className="btn teacher-danger-button"
                      disabled={actionId === protocol.id}
                      onClick={() => runAction(protocol, "deactivate")}
                    >
                      {t("protocols.actions.deactivate")}
                    </button>
                  )}
                </div>
              </div>

              <p className="teacher-protocol-objective">
                {protocol.objective}
              </p>

              <dl className="teacher-protocol-meta">
                <div>
                  <dt>{t("protocols.fields.benchmark")}</dt>
                  <dd>{protocol.benchmark}</dd>
                </div>
                <div>
                  <dt>{t("protocols.fields.inputSize")}</dt>
                  <dd>{protocol.inputSize}</dd>
                </div>
                <div>
                  <dt>{t("protocols.fields.samples")}</dt>
                  <dd>{protocol.samples}</dd>
                </div>
                {protocol.dataType && (
                  <div>
                    <dt>{t("protocols.fields.distribution")}</dt>
                    <dd>{String(protocol.dataType).toUpperCase()}</dd>
                  </div>
                )}
              </dl>

              {protocol.instructions && (
                <details className="teacher-protocol-instructions">
                  <summary>{t("protocols.teacher.instructions")}</summary>
                  <p>{protocol.instructions}</p>
                </details>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
