import React from "react";

import {
  NavLink,
  Outlet,
} from "react-router-dom";

import {
  useI18n,
} from "../i18n";

import "./TeacherDashboard.css";


const TeacherLayout = () => {
  const { t } = useI18n();

  return (
    <div className="teacher-shell">

      <nav
        className="teacher-shell-nav"
        aria-label={t(
          "teacherCourses.header.eyebrow"
        )}
      >

        <NavLink
          to="/teacher/courses"
        >
          {t(
            "teacherCourses.header.title"
          )}
        </NavLink>

      </nav>


      <Outlet />

    </div>
  );
};


export default TeacherLayout;
