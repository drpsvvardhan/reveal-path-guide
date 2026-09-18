import React from "react";
import { createRoot } from "react-dom/client";
import IntakeStep from "../../../src/components/intake/IntakeStep";
import "../../../src/index.css";
createRoot(document.getElementById("root")!).render(
  <>
    <div className="bg-secondary text-secondary-foreground p-3 text-center text-sm">
      Synthetic review fixture · No live patient data or remote services
    </div>
    <IntakeStep
      onRetakeComplete={() => {
        window.location.reload();
      }}
    />
  </>,
);
