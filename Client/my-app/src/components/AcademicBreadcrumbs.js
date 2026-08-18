import React from "react";
import { Link } from "react-router-dom";

import {
  isAdminUser,
  isTeacherUser,
} from "../common/userAccessModel";

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

const formatAcademicCourseLabel = (course, courseId) => {
  const code = cleanText(course?.code);
  const name = cleanText(course?.name);

  if (code && name) return `${code} · ${name}`;
  if (code) return code;
  if (name) return name;

  const normalizedCourseId = cleanIdentifier(
    courseId ?? course?.id
  );
  return normalizedCourseId
    ? `Curso #${normalizedCourseId}`
    : "Curso";
};

const buildAcademicBreadcrumbItems = ({
  currentUser,
  page = "submission",
  submissionId,
  sourceFilename,
  course,
  courseId,
}) => {
  const isResult = page === "result";
  const normalizedSubmissionId = cleanIdentifier(submissionId);
  const normalizedCourseId = cleanIdentifier(
    courseId ?? course?.id
  );
  const resultLabel = cleanFilename(sourceFilename) || "Resultado";
  const items = [];

  if (isAdminUser(currentUser)) {
    items.push(
      {
        key: "administration",
        label: "Administración",
        href: "/admin",
      },
      {
        key: "users",
        label: "Usuarios",
        href: "/admin/users",
      }
    );
  } else if (isTeacherUser(currentUser)) {
    items.push({
      key: "supervision",
      label: "Supervisión",
      href: "/teacher/courses",
    });

    if (normalizedCourseId) {
      items.push({
        key: "course",
        label: formatAcademicCourseLabel(
          course,
          normalizedCourseId
        ),
        href: `/teacher/courses/${encodeURIComponent(
          normalizedCourseId
        )}`,
      });
    }
  } else {
    items.push({
      key: "profile",
      label: "Mi perfil",
      href: "/profile",
    });
  }

  if (normalizedSubmissionId) {
    items.push({
      key: "submission",
      label: `Experimento #${normalizedSubmissionId}`,
      href: isResult
        ? `/submissions/${encodeURIComponent(
            normalizedSubmissionId
          )}`
        : null,
    });
  } else if (!isResult) {
    items.push({
      key: "submission",
      label: "Experimento",
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

  return items.map((item, index) => ({
    ...item,
    current: index === items.length - 1,
  }));
};

const AcademicBreadcrumbs = (props) => {
  const items = buildAcademicBreadcrumbItems(props);

  return (
    <nav
      className="academic-breadcrumbs"
      aria-label="Ruta de navegación"
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
                aria-current={item.current ? "page" : undefined}
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
