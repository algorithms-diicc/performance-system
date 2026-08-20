import React from "react";
import { Link } from "react-router-dom";

import {
  isAdminUser,
  isTeacherUser,
} from "../common/userAccessModel";
import {
  translate,
  useI18n,
} from "../i18n";

import "./AcademicBreadcrumbs.css";

const cleanText = (value) => String(value ?? "").trim();

const cleanIdentifier = (value) => {
  const normalized = cleanText(value);
  return normalized || null;
};

const cleanFilename = (value) => {
  const normalized = cleanText(value).replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || "";
};

const resolveTranslation = (t, key, params) =>
  typeof t === "function"
    ? t(key, params)
    : translate("es", key, params);

const formatAcademicCourseLabel = (
  course,
  courseId,
  t
) => {
  const code = cleanText(course?.code);
  const name = cleanText(course?.name);

  if (code && name) return `${code} · ${name}`;
  if (code) return code;
  if (name) return name;

  const normalizedCourseId = cleanIdentifier(
    courseId ?? course?.id
  );

  return normalizedCourseId
    ? resolveTranslation(
        t,
        "academicBreadcrumbs.courseNumber",
        { id: normalizedCourseId }
      )
    : resolveTranslation(
        t,
        "academicBreadcrumbs.course"
      );
};

const buildAcademicBreadcrumbItems = (
  {
    currentUser,
    page = "submission",
    submissionId,
    sourceFilename,
    course,
    courseId,
  },
  t
) => {
  const tr = (key, params) =>
    resolveTranslation(t, key, params);

  const isResult = page === "result";
  const isComparison = page === "comparison";
  const isDetailPage = isResult || isComparison;
  const normalizedSubmissionId = cleanIdentifier(submissionId);
  const normalizedCourseId = cleanIdentifier(
    courseId ?? course?.id
  );
  const resultLabel =
    cleanFilename(sourceFilename) ||
    tr("academicBreadcrumbs.result");
  const items = [];

  const adminUser = isAdminUser(currentUser);
  const academicSupervisor =
    adminUser || isTeacherUser(currentUser);

  if (adminUser && !normalizedCourseId) {
    items.push(
      {
        key: "administration",
        label: tr(
          "academicBreadcrumbs.administration"
        ),
        href: "/admin",
      },
      {
        key: "users",
        label: tr("academicBreadcrumbs.users"),
        href: "/admin/users",
      }
    );
  } else if (academicSupervisor) {
    items.push({
      key: "supervision",
      label: tr("academicBreadcrumbs.supervision"),
      href: "/teacher/courses",
    });

    if (normalizedCourseId) {
      items.push({
        key: "course",
        label: formatAcademicCourseLabel(
          course,
          normalizedCourseId,
          t
        ),
        href: `/teacher/courses/${encodeURIComponent(
          normalizedCourseId
        )}`,
      });
    }
  } else {
    items.push({
      key: "profile",
      label: tr("academicBreadcrumbs.profile"),
      href: "/profile",
    });
  }

  if (normalizedSubmissionId) {
    items.push({
      key: "submission",
      label: tr(
        "academicBreadcrumbs.experimentNumber",
        { id: normalizedSubmissionId }
      ),
      href: isDetailPage
        ? `/submissions/${encodeURIComponent(
            normalizedSubmissionId
          )}`
        : null,
    });
  } else if (!isDetailPage) {
    items.push({
      key: "submission",
      label: tr("academicBreadcrumbs.experiment"),
      href: null,
    });
  }

  if (isResult) {
    items.push({
      key: "result",
      label: resultLabel,
      href: null,
    });
  }

  if (isComparison) {
    items.push({
      key: "comparison",
      label: tr("academicBreadcrumbs.comparison"),
      href: null,
    });
  }

  return items.map((item, index) => ({
    ...item,
    current: index === items.length - 1,
  }));
};

const AcademicBreadcrumbs = (props) => {
  const { t } = useI18n();
  const items = buildAcademicBreadcrumbItems(
    props,
    t
  );

  return (
    <nav
      className="academic-breadcrumbs"
      aria-label={t(
        "academicBreadcrumbs.navigationAria"
      )}
    >
      <ol>
        {items.map((item, index) => (
          <li key={item.key}>
            {index > 0 && (
              <span
                className="academic-breadcrumbs__separator"
                aria-hidden="true"
              >
                ›
              </span>
            )}

            {item.href && !item.current ? (
              <Link to={item.href} title={item.label}>
                {item.label}
              </Link>
            ) : (
              <span
                className="academic-breadcrumbs__current"
                aria-current={
                  item.current ? "page" : undefined
                }
                title={item.label}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export {
  buildAcademicBreadcrumbItems,
  formatAcademicCourseLabel,
};
export default AcademicBreadcrumbs;
