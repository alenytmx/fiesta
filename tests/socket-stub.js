/** @file Doble de Socket.IO para disparar avisos en pruebas DOM. */
export function io() {
  return {
    on(event, callback) {
      if (event === "changed") window.qaChanged = callback;
      return this;
    },
    disconnect() {},
  };
}
