import React from "react";

import {
  NavLink,
  Outlet,
} from "react-router-dom";

import "./TeacherDashboard.css";


const TeacherLayout = () => (
  <div className="teacher-shell">

    <nav
      className="teacher-shell-nav"
      aria-label="Secciones de supervisión docente"
    >

      <NavLink
        to="/teacher/courses"
      >
        Cursos
      </NavLink>

    </nav>


    <Outlet />

  </div>
);


export default TeacherLayout;
