import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
