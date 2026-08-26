import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import {
  MessageSquareText,
  Send,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import {
  canAccessTeacherArea,
} from "../common/userAccessModel";
import { useI18n } from "../i18n";

import "./TeacherFeedbackPanel.css";


const MAX_FEEDBACK_LENGTH = 2000;


const formatFeedbackDate = (
  value,
  locale,
  fallback
) => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(
    locale || "es-CL",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
};


const TeacherFeedbackPanel = ({
  currentUser,
  submissionId,
  courseId,
}) => {
  const { locale, t } = useI18n();

  const [items, setItems] = useState([]);
  const [state, setState] = useState("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const canWrite = useMemo(
    () =>
      Boolean(courseId) &&
      canAccessTeacherArea(currentUser),
    [courseId, currentUser]
  );

  const encodedSubmissionId = encodeURIComponent(
    String(submissionId || "")
  );
  const endpoint =
    `${serverURL}api/submissions/${encodedSubmissionId}/feedback`;

  const loadFeedback = useCallback(async () => {
    if (!submissionId || !courseId) {
      setItems([]);
      setState("ready");
      return;
    }

    setState("loading");

    try {
      const response = await axios.get(
        endpoint,
        { withCredentials: true }
      );

      setItems(
        Array.isArray(response.data?.items)
          ? response.data.items
          : []
      );
      setState("ready");
    } catch {
      setItems([]);
      setState("error");
    }
  }, [
    courseId,
    endpoint,
    submissionId,
  ]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  if (!courseId) {
    return null;
  }

  const handleSend = async () => {
    const message = draft.trim();

    if (
      !canWrite ||
      !message ||
      message.length > MAX_FEEDBACK_LENGTH ||
      sending
    ) {
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const response = await axios.post(
        endpoint,
        { message },
        { withCredentials: true }
      );

      const created = response.data?.feedback;
      if (created) {
        setItems((current) => [
          ...current,
          created,
        ]);
      }

      setDraft("");
      setState("ready");
    } catch {
      setSendError(
        "teacherFeedback.errors.send"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      className="teacher-feedback"
      aria-labelledby="teacher-feedback-title"
    >
      <div className="teacher-feedback__heading">
        <div>
          <span className="teacher-feedback__eyebrow">
            {t("teacherFeedback.eyebrow")}
          </span>
          <h2 id="teacher-feedback-title">
            {t("teacherFeedback.title")}
          </h2>
          <p>
            {t("teacherFeedback.description")}
          </p>
        </div>

        <MessageSquareText
          size={22}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </div>

      {state === "loading" && (
        <p className="teacher-feedback__state">
          {t("teacherFeedback.loading")}
        </p>
      )}

      {state === "error" && (
        <div
          className="teacher-feedback__state teacher-feedback__state--error"
          role="alert"
        >
          <span>
            {t("teacherFeedback.errors.load")}
          </span>
          <button
            type="button"
            onClick={loadFeedback}
          >
            {t("teacherFeedback.actions.retry")}
          </button>
        </div>
      )}

      {state === "ready" && (
        <>
          {items.length === 0 ? (
            <p className="teacher-feedback__empty">
              {t("teacherFeedback.empty")}
            </p>
          ) : (
            <ol
              className="teacher-feedback__timeline"
              aria-label={t(
                "teacherFeedback.timelineAria"
              )}
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  className="teacher-feedback__item"
                >
                  <div className="teacher-feedback__item-meta">
                    <strong>
                      {item?.author?.fullName ||
                        t(
                          "teacherFeedback.fallbacks.author"
                        )}
                    </strong>
                    <span>
                      {formatFeedbackDate(
                        item.createdAt,
                        locale,
                        t(
                          "teacherFeedback.fallbacks.date"
                        )
                      )}
                    </span>
                  </div>
                  <p>{item.message}</p>
                </li>
              ))}
            </ol>
          )}

          {canWrite && (
            <div className="teacher-feedback__composer">
              <label htmlFor="teacher-feedback-message">
                {t(
                  "teacherFeedback.composer.label"
                )}
              </label>

              <textarea
                id="teacher-feedback-message"
                value={draft}
                rows={4}
                maxLength={MAX_FEEDBACK_LENGTH}
                placeholder={t(
                  "teacherFeedback.composer.placeholder"
                )}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setSendError("");
                }}
                disabled={sending}
              />

              <div className="teacher-feedback__composer-footer">
                <span>
                  {t(
                    "teacherFeedback.composer.characters",
                    {
                      count: draft.length,
                      max: MAX_FEEDBACK_LENGTH,
                    }
                  )}
                </span>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={
                    sending ||
                    !draft.trim()
                  }
                >
                  <Send
                    size={16}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  {sending
                    ? t(
                        "teacherFeedback.actions.sending"
                      )
                    : t(
                        "teacherFeedback.actions.send"
                      )}
                </button>
              </div>

              {sendError && (
                <p
                  className="teacher-feedback__send-error"
                  role="alert"
                >
                  {t(sendError)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};


export default TeacherFeedbackPanel;
