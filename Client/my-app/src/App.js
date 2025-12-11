// Client/my-app/src/App.js

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
import TaskPage from "./screens/TaskPage";
import RenderDoubleForm from "./screens/RenderDobuleForm";
import TutorialPage from "./screens/TutorialPage";
import Login from "./screens/Login";

// Administración de usuarios
import AdminUser from "./screens/AdminUser";
import AdminUserDetail from "./screens/AdminUserDetail";

import Loader from "./components/Loader";

/* ================================================
   Wrapper del Navbar: oculto en /login y si no hay sesión
   ================================================ */
const NavbarWrapper = ({ tasksState, isAuthenticated }) => {
  const location = useLocation();

  // No mostrar navbar en /login ni cuando no hay sesión todavía
  if (location.pathname === "/login") return null;
  if (!isAuthenticated) return null;

  return <Navbar tasksState={tasksState} />;
};

/* ================================================
   Núcleo de la app (usa hooks)
   ================================================ */
const AppInner = () => {
  const [tasksState, setTasksState] = useState({
    lcs: false,
    camm: false,
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    document.title = "Performance System";
  }, []);

  // Chequeo global de sesión al arrancar la app
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Error comprobando sesión:", err);
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  const handleTaskToggle = (taskId, value) => {
    setTasksState((prev) => ({
      ...prev,
      [taskId]: value,
    }));
  };

  // 🔒 Mientras NO sepamos si hay sesión, no mostramos rutas
  if (!authChecked) {
    return <Loader />;
  }

  // A partir de aquí ya sabemos si hay o no usuario autenticado
  return (
    <>
      <NavbarWrapper
        tasksState={tasksState}
        isAuthenticated={isAuthenticated}
      />

      <Routes>
        {/* LOGIN:
            - Si NO está autenticado → muestra <Login />
            - Si SÍ está autenticado → redirige a "/" */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          }
        />

        {/* INICIO:
            - Si está autenticado → RenderForm
            - Si NO → /login */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <RenderForm />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Página de tareas */}
        <Route
          path="/taskpage"
          element={
            isAuthenticated ? (
              <TaskPage
                onTaskToggle={handleTaskToggle}
                tasksState={tasksState}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Comparación de ejecuciones */}
        <Route
          path="/compare"
          element={
            isAuthenticated ? (
              <RenderDoubleForm tasksState={tasksState} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Mostrar imagen/código por nombre */}
        <Route
          path="/code/:codename"
          element={
            isAuthenticated ? (
              <RenderImage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Tutorial y ejemplos */}
        <Route
          path="/tutorial"
          element={
            isAuthenticated ? (
              <TutorialPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Administración de usuarios */}
        <Route
          path="/admin/users"
          element={
            isAuthenticated ? (
              <AdminUser />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/users/:id"
          element={
            isAuthenticated ? (
              <AdminUserDetail />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
};

/* ================================================
   Componente raíz: envuelve todo con BrowserRouter
   ================================================ */
const App = () => {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
};

export default App;
