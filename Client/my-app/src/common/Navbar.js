import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";

import {
  Plus,
  History,
  CircleHelp,
  Sun,
  Moon,
  UserRound,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";

import {
  canAccessTeacherArea,
  isAdminUser,
} from "./userAccessModel";

import LanguageSwitcher from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";

import "./Navbar.css";


/* ============================================================
   PERFORMANCE SYSTEM NAVBAR
   ============================================================ */

function Navbar({
  currentUser,
  onLogout,
}) {

  const location = useLocation();

  const { t } = useI18n();

  const userMenuRef = useRef(null);


  /* ==========================================================
     UI STATE
     ========================================================== */

  const [
    isUserMenuOpen,
    setIsUserMenuOpen,
  ] = useState(false);


  const [
    isMobileMenuOpen,
    setIsMobileMenuOpen,
  ] = useState(false);


  /* ==========================================================
     THEME

     index.js ya aplica el tema inicial antes de montar React.

     Navbar únicamente mantiene el control interactivo.
     ========================================================== */

  const [theme, setTheme] = useState(() => {

    if (typeof window === "undefined") {
      return "dark";
    }


    return (
      document.documentElement
        .getAttribute("data-theme")
      ||
      window.localStorage
        .getItem("ps-theme")
      ||
      "dark"
    );

  });


  useEffect(() => {

    document.documentElement
      .setAttribute(
        "data-theme",
        theme
      );


    try {

      window.localStorage
        .setItem(
          "ps-theme",
          theme
        );

    } catch (error) {

      console.warn(
        "No fue posible guardar el tema:",
        error
      );

    }

  }, [theme]);


  const toggleTheme = () => {

    setTheme((previous) =>
      previous === "dark"
        ? "light"
        : "dark"
    );

  };


  /* ==========================================================
     USER
     ========================================================== */

  const user =
    currentUser ?? null;


  const isAdmin =
    isAdminUser(user);


  const canSupervise =
    canAccessTeacherArea(user);


  const displayName =
    user?.full_name
    ||
    user?.name
    ||
    t("common.user");


  const displayEmail =
    user?.email
    ||
    "";


  const displayRole =
    isAdmin
      ? t("roles.admin")
      : (
          canSupervise
            ? t("roles.teacher")
            : t("roles.student")
        );


  /* ==========================================================
     INITIALS
     ========================================================== */

  const getInitials = (
    fullName,
    email
  ) => {

    if (
      fullName
      &&
      fullName.trim()
    ) {

      const parts =
        fullName
          .trim()
          .split(/\s+/);


      if (parts.length === 1) {

        return parts[0]
          .charAt(0)
          .toUpperCase();

      }


      return (
        parts[0]
          .charAt(0)
        +
        parts[
          parts.length - 1
        ]
          .charAt(0)
      )
        .toUpperCase();

    }


    if (email) {

      return email
        .charAt(0)
        .toUpperCase();

    }


    return "?";

  };


  const initials =
    getInitials(
      displayName,
      displayEmail
    );


  /* ==========================================================
     NAVIGATION

     Solo mostramos funcionalidades activas del producto.
     Las rutas legacy TaskPage/Compare quedan fuera de navegación.
     ========================================================== */

  const navItems = useMemo(() => {

    const items = [
      {
        path: "/",
        label: t("nav.newAnalysis"),
        icon: Plus,
        end: true,
      },
      {
        path: "/history",
        label: t("nav.history"),
        icon: History,
        end: false,
      },
      {
        path: "/tutorial",
        label: t("nav.tutorial"),
        icon: CircleHelp,
        end: false,
      },
    ];


    if (canSupervise) {

      items.push({
        path: "/teacher/courses",
        label: t("nav.supervision"),
        icon: UserRound,
        end: false,
      });

    }


    if (isAdmin) {

      items.push({
        path: "/admin/users",
        label: t("nav.administration"),
        icon: ShieldCheck,
        end: false,
      });

    }


    return items;

  }, [canSupervise, isAdmin, t]);


  /* ==========================================================
     CLOSE MENUS WHEN ROUTE CHANGES
     ========================================================== */

  useEffect(() => {

    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);

  }, [location.pathname]);


  /* ==========================================================
     CLICK OUTSIDE USER MENU
     ========================================================== */

  useEffect(() => {

    const handleMouseDown = (event) => {

      if (
        userMenuRef.current
        &&
        !userMenuRef.current
          .contains(event.target)
      ) {

        setIsUserMenuOpen(false);

      }

    };


    document.addEventListener(
      "mousedown",
      handleMouseDown
    );


    return () => {

      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );

    };

  }, []);


  /* ==========================================================
     ESCAPE
     ========================================================== */

  useEffect(() => {

    const handleKeyDown = (event) => {

      if (event.key !== "Escape") {
        return;
      }


      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);

    };


    window.addEventListener(
      "keydown",
      handleKeyDown
    );


    return () => {

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );

    };

  }, []);


  /* ==========================================================
     LOGOUT
     ========================================================== */

  const handleLogout = async () => {

    try {

      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );


      if (!response.ok) {

        console.warn(
          "El backend respondió con estado",
          response.status,
          "durante logout."
        );

      }

    } catch (error) {

      console.warn(
        "Error al cerrar sesión:",
        error
      );

    } finally {

      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);


      /*
       * App.js elimina currentUser.
       *
       * Las rutas protegidas se encargan
       * automáticamente de ir a /login.
       */

      if (onLogout) {
        onLogout();
      }

    }

  };


  /* ==========================================================
     NAV LINKS
     ========================================================== */

  const renderNavLinks = (
    mobile = false
  ) => {

    return navItems.map((item) => {

      const Icon =
        item.icon;


      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({
            isActive,
          }) =>
            [
              "app-nav-link",
              mobile
                ? "app-nav-link-mobile"
                : "",
              isActive
                ? "is-active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
        >

          <Icon
            size={18}
            strokeWidth={1.9}
            aria-hidden="true"
          />

          <span>
            {item.label}
          </span>

        </NavLink>
      );

    });

  };


  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <header className="app-navbar">

      <div className="app-navbar-inner">

        {/* ====================================================
            BRAND
            ==================================================== */}

        <Link
          to="/"
          className="app-navbar-brand"
          aria-label={t("navbar.brandAria")}
        >

          <img
            src="/iconSP.png"
            alt=""
            width="32"
            height="32"
            className="app-navbar-logo"
          />

          <span className="app-navbar-brand-text">
            Performance System
          </span>

        </Link>


        {/* ====================================================
            DESKTOP NAVIGATION
            ==================================================== */}

        <nav
          className="app-navbar-menu"
          aria-label={t("navbar.mainNavigationAria")}
        >

          {renderNavLinks(false)}

        </nav>


        {/* ====================================================
            RIGHT ACTIONS
            ==================================================== */}

        <div className="app-navbar-actions">

          <LanguageSwitcher variant="navbar" />

          {/* THEME */}

          <button
            type="button"
            className="app-navbar-icon-button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? t("navbar.themeToLight")
                : t("navbar.themeToDark")
            }
            title={
              theme === "dark"
                ? t("navbar.themeToLight")
                : t("navbar.themeToDark")
            }
          >

            {theme === "dark" ? (
              <Sun
                size={19}
                strokeWidth={1.9}
              />
            ) : (
              <Moon
                size={19}
                strokeWidth={1.9}
              />
            )}

          </button>


          {/* ==================================================
              USER MENU
              ================================================== */}

          <div
            ref={userMenuRef}
            className="app-user-menu-wrapper"
          >

            <button
              type="button"
              className="app-user-menu-toggle"
              onClick={() =>
                setIsUserMenuOpen(
                  (previous) => !previous
                )
              }
              aria-expanded={
                isUserMenuOpen
              }
              aria-haspopup="menu"
            >

              <span className="app-user-avatar">
                {initials}
              </span>


              <span className="app-user-info">

                <span className="app-user-name">
                  {displayName}
                </span>

                {displayEmail && (
                  <span className="app-user-email">
                    {displayEmail}
                  </span>
                )}

              </span>


              <ChevronDown
                size={16}
                strokeWidth={2}
                className={
                  isUserMenuOpen
                    ? "app-user-chevron is-open"
                    : "app-user-chevron"
                }
                aria-hidden="true"
              />

            </button>


            {/* =================================================
                DROPDOWN
                ================================================= */}

            {isUserMenuOpen && (

              <div
                className="app-user-dropdown-menu"
                role="menu"
              >

                <div className="app-user-dropdown-header">

                  <span className="app-user-dropdown-avatar">
                    {initials}
                  </span>


                  <div className="app-user-dropdown-info">

                    <span className="app-user-dropdown-name">
                      {displayName}
                    </span>


                    {displayEmail && (

                      <span className="app-user-dropdown-email">
                        {displayEmail}
                      </span>

                    )}


                    <span className="app-user-dropdown-role">
                      {displayRole}
                    </span>

                  </div>

                </div>


                <div className="app-user-dropdown-divider" />
{/* Perfil: visible para comunicar la futura
                    arquitectura, pero claramente deshabilitado. */}

                <button
                  type="button"
                  role="menuitem"
                  className="app-user-dropdown-item"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    window.location.href =
                      "/profile";
                  }}
                >

                  <UserRound
                    size={17}
                    strokeWidth={1.9}
                  />

                  <span>
                    {t("navbar.profile")}
                  </span>

                </button>


                <div className="app-user-dropdown-divider" />


                <button
                  type="button"
                  role="menuitem"
                  className="
                    app-user-dropdown-item
                    app-user-dropdown-item-logout
                  "
                  onClick={handleLogout}
                >

                  <LogOut
                    size={17}
                    strokeWidth={1.9}
                  />

                  <span>
                    {t("navbar.logout")}
                  </span>

                </button>

              </div>

            )}

          </div>


          {/* ==================================================
              MOBILE BUTTON
              ================================================== */}

          <button
            type="button"
            className="
              app-navbar-icon-button
              app-navbar-mobile-toggle
            "
            onClick={() =>
              setIsMobileMenuOpen(
                (previous) => !previous
              )
            }
            aria-expanded={
              isMobileMenuOpen
            }
            aria-label={
              isMobileMenuOpen
                ? t("navbar.closeNavigation")
                : t("navbar.openNavigation")
            }
          >

            {isMobileMenuOpen ? (
              <X
                size={21}
                strokeWidth={2}
              />
            ) : (
              <Menu
                size={21}
                strokeWidth={2}
              />
            )}

          </button>

        </div>


        {/* ====================================================
            MOBILE NAVIGATION
            ==================================================== */}

        {isMobileMenuOpen && (

          <nav
            className="app-navbar-mobile-menu"
            aria-label={t("navbar.mobileNavigationAria")}
          >

            {renderNavLinks(true)}

          </nav>

        )}

      </div>

    </header>
  );
}


export default Navbar;