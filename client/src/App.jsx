/** @file Contenedor de sesión y navegación; cada módulo conserva su propia frontera de estado. */
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  Component,
} from "react";
import {
  Users,
  FileText,
  UserRound,
  Mail,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { io } from "socket.io-client";
import { AppContext } from "./context/AppContext.jsx";
import ToastStack from "./components/ToastStack.jsx";
import { DEFAULT_REPORT } from "../../shared/report-defaults.js";
import { createRequest, API } from "./lib/api.js";
import Access from "./components/Access.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import QuotesPage from "./pages/QuotesPage.jsx";
import GuestsPage from "./pages/GuestsPage.jsx";
import InvitationsPage from "./pages/InvitationsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
const PAGES = {
  clients: [ClientsPage, "Clientes", Users],
  quotes: [QuotesPage, "Cotizaciones", FileText],
  guests: [GuestsPage, "Invitados", UserRound],
  invitations: [InvitationsPage, "Invitaciones", Mail],
  settings: [SettingsPage, "Configuración", Settings],
};
/** Frontera de errores: un fallo de una pantalla no elimina el menú ni deja la aplicación en blanco. */
class PageBoundary extends Component {
  state = { failed: false };
  /** @returns {{failed:boolean}} Estado recuperable tras un error de render. */
  static getDerivedStateFromError() {
    return { failed: true };
  }
  /** @returns {React.ReactNode} Pantalla actual o acción de recuperación. */
  render() {
    return this.state.failed ? (
      <main>
        <p role="alert">No se pudo mostrar esta sección.</p>
        <button onClick={() => this.setState({ failed: false })}>
          Volver a intentar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
/** @returns {React.ReactElement} Aplicación con autenticación y cinco módulos independientes. */
export default function App() {
  const [session, setSession] = useState(null),
    [section, setSection] = useState("quotes"),
    [error, setError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_REPORT),
    [brand, setBrand] = useState(DEFAULT_REPORT),
    [revision, setRevision] = useState(0),
    [resource, setResource] = useState(""),
    [online, setOnline] = useState(false),
    [toasts, setToasts] = useState([]);
  const [themeOverride, setThemeOverride] = useState(
    () => localStorage.getItem("fiesta-theme") || "",
  );
  const notify = useCallback(
    (message, type = "success") =>
      setToasts((t) => [
        ...t.slice(-2),
        { id: crypto.randomUUID(), message, type },
      ]),
    [],
  );
  const dismiss = useCallback(
    (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );
  const request = useMemo(
    () => createRequest(session?.token, () => setSession(null), notify),
    [session, notify],
  );
  /** Recarga identidad pública sin exponer RFC, firma ni configuración privada antes del login. */
  const loadBrand = useCallback(
    () =>
      request("/branding")
        .then((b) => setBrand({ ...DEFAULT_REPORT, ...b }))
        .catch(() => {}),
    [request],
  );
  useEffect(() => {
    loadBrand();
  }, [loadBrand]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    request("/settings")
      .then((s) => {
        if (active) setSettings({ ...DEFAULT_REPORT, ...s });
      })
      .catch((e) => notify(e.message, "error"));
    return () => {
      active = false;
    };
  }, [session, request, resource === "settings" ? revision : 0]);
  useEffect(() => {
    if (!session) return;
    const url = new URL(API, location.href);
    const endpoint = import.meta.env.VITE_SOCKET_URL || url.origin;
    const socket = io(endpoint, {
      auth: { token: session.token },
      reconnection: true,
    });
    const changed = ({ resource: r = "all" } = {}) => {
      setResource(r);
      setRevision((n) => n + 1);
      if (r === "settings") loadBrand();
    };
    socket.on("connect", () => {
      setOnline(true);
      changed({ resource: "all" });
    });
    socket.on("changed", changed);
    socket.on("disconnect", () => setOnline(false));
    socket.on("connect_error", () => setOnline(false));
    return () => socket.disconnect();
  }, [session, loadBrand]);
  const design = session ? settings : brand;
  useEffect(() => {
    const mode = themeOverride || design.theme;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        mode === "system" ? (media?.matches ? "dark" : "light") : mode;
      document.title = design.programName || "Fiesta";
    };
    apply();
    media?.addEventListener?.("change", apply);
    for (const [field, css] of [
      ["primaryColor", "--primary"],
      ["titleColor", "--title-color"],
      ["tableColor", "--table-color"],
      ["indicatorColor", "--indicator-color"],
    ])
      document.documentElement.style.setProperty(
        css,
        design[field] || DEFAULT_REPORT[field],
      );
    return () => media?.removeEventListener?.("change", apply);
  }, [design, themeOverride]);
  const context = {
    settings,
    revision,
    resource,
    notify,
    refreshSettings: (s) => {
      setSettings(s);
      setThemeOverride("");
      localStorage.removeItem("fiesta-theme");
      loadBrand();
    },
  };
  if (!session)
    return (
      <>
        <Access
          brand={brand}
          logoUrl={
            brand.hasLogo ? API + "/branding/logo?v=" + brand.version : null
          }
          request={request}
          onLogin={async (data) => {
            setSession(
              await request("/auth/login", {
                method: "POST",
                body: JSON.stringify(data),
              }),
            );
            setError("");
          }}
        />
        <ToastStack items={toasts} onClose={dismiss} />
      </>
    );
  const Page = PAGES[section][0];
  return (
    <AppContext.Provider value={context}>
      <header className="top">
        <span className="brand">
          {settings.logo ? (
            <img
              className="menulogo"
              src={API + "/branding/logo?v=" + brand.version}
              alt={settings.programName}
            />
          ) : (
            <span className="brandmark">
              {settings.programName?.slice(0, 1)}
            </span>
          )}
          <span>
            {settings.programName}
            <small className="menuslogan">{settings.menuSlogan}</small>
          </span>
        </span>
        <div className="account">
          <span>
            {session.email}
            <small className="syncstatus">
              {online ? "En tiempo real" : "Reconectando…"}
            </small>
          </span>
          <button
            className="textbutton"
            aria-label="Cambiar modo claro u oscuro"
            onClick={() => {
              const next =
                document.documentElement.dataset.theme === "dark"
                  ? "light"
                  : "dark";
              localStorage.setItem("fiesta-theme", next);
              setThemeOverride(next);
            }}
          >
            {document.documentElement.dataset.theme === "dark" ? (
              <Sun size={18} />
            ) : (
              <Moon size={18} />
            )}
          </button>
          <button
            className="textbutton"
            onClick={async () => {
              try {
                await request("/auth/logout", { method: "POST" });
                setSession(null);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </header>
      <nav aria-label="Menú principal">
        {Object.entries(PAGES).map(([key, [, label, Icon]]) => (
          <button
            key={key}
            aria-current={key === section ? "page" : undefined}
            className={key === section ? "active" : ""}
            onClick={() => {
              setSection(key);
              setError("");
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <PageBoundary key={section}>
        <Page request={request} />
      </PageBoundary>
      <ToastStack items={toasts} onClose={dismiss} />
    </AppContext.Provider>
  );
}
