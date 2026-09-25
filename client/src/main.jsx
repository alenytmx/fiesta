/** @file Punto de entrada del frontend React. */
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./style.css";
createRoot(document.getElementById("root")).render(<App />);
