/** @file Iconos de redes incorporados al programa. */
import React from "react";
/** @returns {React.ReactElement} Símbolo de Facebook. */
export function Facebook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-label="Facebook">
      <path
        fill="currentColor"
        d="M14 22v-9h3l.5-4H14V7c0-1 .5-1.5 1.5-1.5H18V2h-3c-3 0-5 2-5 5v2H7v4h3v9z"
      />
    </svg>
  );
}
/** @returns {React.ReactElement} Símbolo de Instagram. */
export function Instagram() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-label="Instagram"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".7" />
    </svg>
  );
}
