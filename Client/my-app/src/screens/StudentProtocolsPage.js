import React, {
  useEffect,
  useState,
} from "react";

import axios from "axios";
import { Link } from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  serverURL,
} from "../common/Constants";

import {
  useI18n,
} from "../i18n";

import "./StudentProtocolsPage.css";


function protocolProfileLabel(
  profile,
  t
) {
  const key =
    `protocols.profiles.${profile}`;

  const normalizedKeyMap = {
    rapido: "quick",
    equilibrado: "balanced",
    exhaustivo: "exhaustive",
    personalizado: "custom",
  };

  return t(
    `protocols.profiles.${
      normalizedKeyMap[profile]
      || profile
    }`
  ) || t(key);
}


export default function StudentProtocolsPage() {
  const { t } = useI18n();

  const [
    protocols,
    setProtocols,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(false);

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);


  useEffect(() => {
    let cancelled = false;

    const loadProtocols = async () => {
      try {
        setLoading(true);
        setError(false);

        const response =
          await axios.get(
            `${serverURL}api/student/protocols`,
            {
              withCredentials: true,
              headers: {
                "Cache-Control":
                  "no-cache",
                Pragma:
                  "no-cache",
              },
            }
          );

        if (cancelled) {
          return;
        }

        setProtocols(
          Array.isArray(
            response.data?.items
          )
            ? response.data.items
            : []
        );
      } catch (_) {
        if (!cancelled) {
          setProtocols([]);
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProtocols();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);


  return (
    <main className="student-protocol-page">
      <div className="student-protocol-inner">
        <header className="student-protocol-header">
          <span className="student-protocol-eyebrow">
            {t(
              "protocols.student.eyebrow"
            )}
          </span>

          <h1>
            {t(
              "protocols.student.title"
            )}
          </h1>

          <p>
            {t(
              "protocols.student.description"
            )}
          </p>
        </header>


        {loading ? (
          <InlineState
            type="loading"
            title={t(
              "protocols.student.loading"
            )}
            compact
          />
        ) : error ? (
          <InlineState
            type="error"
            title={t(
              "protocols.student.loadErrorTitle"
            )}
            description={t(
              "protocols.student.errors.load"
            )}
            actionLabel={t(
              "protocols.actions.retry"
            )}
            onAction={() =>
              setReloadToken(
                (value) => value + 1
              )
            }
            compact
          />
        ) : protocols.length === 0 ? (
          <section className="student-protocol-empty">
            <h2>
              {t(
                "protocols.student.emptyTitle"
              )}
            </h2>
            <p>
              {t(
                "protocols.student.emptyText"
              )}
            </p>
            <Link
              to="/"
              className="btn student-protocol-secondary"
            >
              {t(
                "protocols.student.personalAnalysis"
              )}
            </Link>
          </section>
        ) : (
          <section
            className="student-protocol-grid"
            aria-label={t(
              "protocols.student.listAria"
            )}
          >
            {protocols.map(
              (protocol) => (
                <article
                  key={protocol.id}
                  className="student-protocol-card"
                >
                  <div className="student-protocol-course">
                    {protocol.course?.code
                      || t(
                        "protocols.student.courseFallback"
                      )}
                    {" · "}
                    {protocol.course
                      ?.academicYear}
                    -
                    {protocol.course
                      ?.academicTerm}
                  </div>

                  <h2>
                    {protocol.title}
                  </h2>

                  <p className="student-protocol-objective">
                    {protocol.objective}
                  </p>

                  <dl className="student-protocol-meta">
                    <div>
                      <dt>
                        {t(
                          "protocols.fields.benchmark"
                        )}
                      </dt>
                      <dd>
                        {protocol.benchmark}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        {t(
                          "protocols.fields.inputSize"
                        )}
                      </dt>
                      <dd>
                        {protocol.inputSize}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        {t(
                          "protocols.fields.profile"
                        )}
                      </dt>
                      <dd>
                        {protocolProfileLabel(
                          protocol
                            .executionProfile,
                          t
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>
                        {t(
                          "protocols.fields.samples"
                        )}
                      </dt>
                      <dd>
                        {protocol.samples}
                      </dd>
                    </div>

                    {protocol.dataType && (
                      <div>
                        <dt>
                          {t(
                            "protocols.fields.distribution"
                          )}
                        </dt>
                        <dd>
                          {String(
                            protocol.dataType
                          ).toUpperCase()}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {protocol.instructions && (
                    <details className="student-protocol-instructions">
                      <summary>
                        {t(
                          "protocols.student.instructions"
                        )}
                      </summary>
                      <p>
                        {
                          protocol.instructions
                        }
                      </p>
                    </details>
                  )}

                  <div className="student-protocol-actions">
                    <Link
                      to={`/?protocol=${encodeURIComponent(
                        protocol.id
                      )}`}
                      className="btn student-protocol-primary"
                    >
                      {t(
                        "protocols.student.prepareAnalysis"
                      )}
                    </Link>
                  </div>
                </article>
              )
            )}
          </section>
        )}
      </div>
    </main>
  );
}
