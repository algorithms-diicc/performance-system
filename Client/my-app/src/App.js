import React, { useEffect, useState } from "react";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import RenderForm from "./screens/RenderForm";
import RenderImage from "./screens/RenderImage";
import Navbar from "./common/Navbar";
import {
  canAccessTeacherArea,
  isAdminUser,
} from "./common/userAccessModel";
import TutorialPage from "./screens/TutorialPage";
import ProfilePage from "./screens/ProfilePage";
import HistoryPage from "./screens/HistoryPage";
import SystemStatePage from "./screens/SystemStatePage";
import SubmissionOverviewPage from "./screens/SubmissionOverviewPage";
import ComparisonPage from "./screens/ComparisonPage";
import Login from "./screens/Login";

import AdminUser from "./screens/AdminUser";
import AdminUserDetail from "./screens/AdminUserDetail";
import AdminLayout from "./screens/AdminLayout";
import AdminAccessRequests from "./screens/AdminAccessRequests";
import AdminAuditLog from "./screens/AdminAuditLog";
import AdminSystemStatus from "./screens/AdminSystemStatus";

import TeacherLayout from "./screens/TeacherLayout";
import TeacherCourses from "./screens/TeacherCourses";
import TeacherCourseDetail from "./screens/TeacherCourseDetail";
import TeacherStudentDetail from "./screens/TeacherStudentDetail";

import Loader from "./components/Loader";
import AppErrorBoundary from "./components/AppErrorBoundary";


/* ============================================================
   NAVBAR WRAPPER

   La navbar:
   - no aparece en /login;
   - no aparece si no hay sesión;
   - recibe el usuario desde App.

   App será desde ahora la fuente de verdad de la sesión.
   ============================================================ */

const NavbarWrapper = ({
  currentUser,
  onLogout,
}) => {

  const location = useLocation();

  if (location.pathname === "/login") {
    return null;
  }

  if (!currentUser) {
    return null;
  }

  return (
    <Navbar
      currentUser={currentUser}
      onLogout={onLogout}
    />
  );
};


/* ============================================================
   APP INNER
   ============================================================ */

const AppInner = () => {

  /* ----------------------------------------------------------
     Autenticación

     Ya no mantenemos:
       isAuthenticated + user por separado.

     currentUser:
       null    → no autenticado
       objeto  → autenticado
     ---------------------------------------------------------- */

  const [currentUser, setCurrentUser] = useState(null);

  const [authChecked, setAuthChecked] =
    useState(false);


  /* ==========================================================
     DOCUMENT TITLE
     ========================================================== */

  useEffect(() => {

    document.title =
      "Performance System";

  }, []);


  /* ==========================================================
     CHECK SESSION
     ========================================================== */

  useEffect(() => {

    let mounted = true;


    const checkAuth = async () => {

      try {

        const response = await fetch(
          "/api/auth/me",
          {
            credentials: "include",
          }
        );


        if (!response.ok) {

          if (mounted) {
            setCurrentUser(null);
          }

          return;
        }


        const data =
          await response.json();


        /*
         * Permitimos tanto:
         *
         * { id, email, ... }
         *
         * como:
         *
         * { user: { ... } }
         *
         * para no acoplar innecesariamente React
         * al formato exacto del endpoint.
         */

        const user =
          data?.user ?? data;


        if (mounted) {
          setCurrentUser(user);
        }

      } catch (error) {

        console.error(
          "Error comprobando sesión:",
          error
        );


        if (mounted) {
          setCurrentUser(null);
        }

      } finally {

        if (mounted) {
          setAuthChecked(true);
        }

      }

    };


    checkAuth();


    return () => {
      mounted = false;
    };

  }, []);


  /* ==========================================================
     LOGOUT

     Navbar ejecuta el POST.
     Cuando termina nos informa y App elimina la sesión local.

     Al desaparecer currentUser las rutas protegidas
     redirigen automáticamente a /login.
     ========================================================== */

  const handleLogout = () => {

    setCurrentUser(null);

  };


  /* ==========================================================
     LOADER INICIAL
     ========================================================== */

  if (!authChecked) {

    return <Loader />;

  }


  const isAuthenticated =
    Boolean(currentUser);

  const isAdmin =
    isAdminUser(currentUser);

  const canSupervise =
    canAccessTeacherArea(currentUser);


  /* ==========================================================
     ROUTES
     ========================================================== */

  return (
    <>
      <NavbarWrapper
        currentUser={currentUser}
        onLogout={handleLogout}
      />


      <Routes>

        {/* ====================================================
            LOGIN
            ==================================================== */}

        <Route
          path="/login"
          element={
            isAuthenticated
              ? (
                <Navigate
                  to="/"
                  replace
                />
              )
              : (
                <Login />
              )
          }
        />


        {/* ====================================================
            NUEVO ANÁLISIS
            ==================================================== */}

        <Route
          path="/"
          element={
            isAuthenticated
              ? (
                <RenderForm currentUser={currentUser} />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            RESULTADO / CÓDIGO
            ==================================================== */}

        <Route
          path="/code/:codename"
          element={
            isAuthenticated
              ? (
                <RenderImage currentUser={currentUser} />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />

        <Route
          path="/submissions/:submissionId"
          element={
            isAuthenticated
              ? (
                <SubmissionOverviewPage currentUser={currentUser} />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />

        <Route
          path="/compare"
          element={
            isAuthenticated
              ? (
                <ComparisonPage currentUser={currentUser} />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            HISTORIAL
            ==================================================== */}

        <Route
          path="/history"
          element={
            isAuthenticated
              ? (
                <HistoryPage />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            AYUDA
            ==================================================== */}

        <Route
          path="/tutorial"
          element={
            isAuthenticated
              ? (
                <TutorialPage />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            MI PERFIL
            ==================================================== */}

        <Route
          path="/profile"
          element={
            isAuthenticated
              ? (
                <ProfilePage />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            SUPERVISIÓN DOCENTE
            ==================================================== */}

        <Route
          path="/teacher"
          element={
            isAuthenticated
              ? (
                canSupervise
                  ? <TeacherLayout />
                  : <Navigate to="/403" replace />
              )
              : <Navigate to="/login" replace />
          }
        >
          <Route
            index
            element={
              <Navigate
                to="courses"
                replace
              />
            }
          />
          <Route
            path="courses"
            element={
              <TeacherCourses
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="courses/:courseId"
            element={
              <TeacherCourseDetail
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="courses/:courseId/students/:userId"
            element={<TeacherStudentDetail />}
          />
        </Route>


        {/* ADMINISTRACIÓN */}

        <Route
          path="/admin"
          element={
            isAuthenticated
              ? (isAdmin ? <AdminLayout /> : <Navigate to="/403" replace />)
              : <Navigate to="/login" replace />
          }
        >
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<AdminUser />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="access-requests" element={<AdminAccessRequests />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
          <Route path="system-status" element={<AdminSystemStatus />} />
        </Route>

        {/* ====================================================
            ESTADOS GLOBALES
            ==================================================== */}

        <Route
          path="/403"
          element={
            isAuthenticated
              ? (
                <SystemStatePage
                  statusCode="403"
                />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        <Route
          path="/500"
          element={
            isAuthenticated
              ? (
                <SystemStatePage
                  statusCode="500"
                />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />


        {/* ====================================================
            RUTA DESCONOCIDA
            ==================================================== */}

        <Route
          path="*"
          element={
            isAuthenticated
              ? (
                <SystemStatePage
                  statusCode="404"
                />
              )
              : (
                <Navigate
                  to="/login"
                  replace
                />
              )
          }
        />

      </Routes>
    </>
  );
};


/* ============================================================
   ROOT
   ============================================================ */

const App = () => {

  return (
    <BrowserRouter>

      <AppErrorBoundary>

        <AppInner />

      </AppErrorBoundary>

    </BrowserRouter>
  );

};


export default App;
