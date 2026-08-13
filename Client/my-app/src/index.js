import React from "react";
import ReactDOM from "react-dom";

import "bootstrap/dist/css/bootstrap.css";

import "./styles/tokens.css";
import "./styles/theme-light.css";
import "./styles/theme-dark.css";
import "./styles/globals.css";

import App from "./App";
import reportWebVitals from "./reportWebVitals";


/*
 * ============================================================
 * INITIAL THEME
 * ============================================================
 *
 * Se determina el tema antes de renderizar React.
 *
 * Esto evita que el navegador muestre brevemente el tema
 * incorrecto cuando el usuario recarga la aplicación.
 *
 * Navbar.js actualmente utiliza la misma key:
 *
 * ps-theme
 *
 * Por lo tanto esta implementación es compatible con la navbar
 * actual.
 */

const initializeTheme = () => {

  try {

    const savedTheme =
      window.localStorage.getItem(
        "ps-theme"
      );


    const initialTheme =
      savedTheme === "light" ||
      savedTheme === "dark"
        ? savedTheme
        : "dark";


    document.documentElement.setAttribute(
      "data-theme",
      initialTheme
    );

  } catch (error) {

    /*
     * localStorage puede estar bloqueado en situaciones
     * particulares.
     *
     * Dark queda como fallback seguro.
     */

    document.documentElement.setAttribute(
      "data-theme",
      "dark"
    );
  }
};


initializeTheme();


ReactDOM.render(
  <React.StrictMode>

    <App />

  </React.StrictMode>,

  document.getElementById("root")
);


reportWebVitals();