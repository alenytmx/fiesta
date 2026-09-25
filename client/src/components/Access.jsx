/** @file Access — componente independiente de presentación e interacción. */
import React, { useEffect, useState, useRef, useId } from "react";
import { money, single } from "../lib/common.js";
/**
 * Gestiona el alta inicial única y el inicio de sesión.
 * @param {object} props Propiedades del componente.
 * @returns {React.ReactElement} Vista del componente.
 */
export default function Access({ onLogin, request, brand, logoUrl }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(null);
  const [key, setKey] = useState(() => {
    const key = new URLSearchParams(location.hash.slice(1)).get("setup") || "";
    if (key)
      history.replaceState(null, "", location.pathname + location.search);
    return key;
  });
  const load = () => {
    setError("");
    request("/setup/status")
      .then((x) => setSetup(x.required))
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  return (
    <div className="loginpage">
      <div className="loginintro">
        <div className="loginbrand">
          {logoUrl ? (
            <img className="loginlogo" src={logoUrl} alt={brand.programName} />
          ) : (
            <span className="brandmark">
              {brand.programName?.slice(0, 1) || "F"}
            </span>
          )}
          <p className="eyebrow">{brand.programName}</p>
        </div>
        <h1>{brand.loginSlogan}</h1>
        <p>Organiza tus eventos, cotizaciones y pagos desde un solo lugar.</p>
        <div className="loginfeatures">
          <span>Clientes</span>
          <span>Cotizaciones</span>
          <span>Invitaciones</span>
        </div>
      </div>
      <form
        className="loginform"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (setup) {
              if (password !== confirm)
                throw new Error("Las contraseñas no coinciden.");
              await request("/setup", {
                method: "POST",
                body: JSON.stringify({ email, password, setupToken: key }),
              });
              setSetup(false);
              setPassword("");
              setConfirm("");
              setKey("");
              setNotice(
                "Administrador creado. Inicia sesión con tu correo y contraseña.",
              );
            } else await onLogin({ email, password });
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="eyebrow">
          {setup ? "PRIMERA INSTALACIÓN" : "BIENVENIDO"}
        </p>
        <h2>{setup ? "Crear administrador" : "Iniciar sesión"}</h2>
        <p className="muted">
          {setup
            ? "Esta cuenta se configura una sola vez."
            : "Ingresa con tu cuenta de administrador."}
        </p>
        {error && (
          <p role="alert" className="alert error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="alert success">
            {notice}
          </p>
        )}
        {setup === null ? (
          <>
            <p>Comprobando la instalación…</p>
            <button type="button" onClick={load}>
              Reintentar conexión
            </button>
          </>
        ) : (
          <>
            <label>
              Correo electrónico
              <input
                type="email"
                autoComplete="username"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete={setup ? "new-password" : "current-password"}
                minLength={setup ? 12 : 1}
                maxLength={72}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {setup && (
              <>
                <p className="muted">
                  Usa al menos 12 caracteres. Máximo 72 bytes; los acentos y
                  emojis pueden ocupar más de uno.
                </p>
                <label>
                  Confirmar contraseña
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                {
                  <label>
                    Clave de instalación
                    <input
                      type="password"
                      required
                      minLength={32}
                      value={key}
                      autoComplete="off"
                      onChange={(e) => setKey(e.target.value)}
                    />
                    <span className="muted">
                      Abre la aplicación desde INICIAR-FIESTA.bat o consulta
                      server/.setup-key.
                    </span>
                  </label>
                }
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Procesando…" : setup ? "Crear administrador" : "Entrar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
