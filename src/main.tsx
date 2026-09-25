import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Enregistrement du Service Worker pour installation sur le bureau / mobile (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("Service Worker registration notice:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
