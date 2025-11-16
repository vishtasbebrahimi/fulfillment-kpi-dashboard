import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { DashboardPage } from "./DashboardPage";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DashboardPage />
  </React.StrictMode>
);
