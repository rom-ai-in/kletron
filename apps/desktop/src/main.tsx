import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import PopoutConversation from "./app/PopoutConversation";
import { ThemeProvider } from "@kletron/ui/hooks/useTheme";
import { ToastProvider } from "@kletron/ui/components/design-system";
import "./app/styles.css";

/**
 * Hash-based routing for pop-out windows.
 * If the URL hash is #/popout/:threadId, render PopoutConversation.
 * Otherwise, render the main App.
 */
function Root() {
  const hash = window.location.hash;
  const popoutMatch = hash.match(/^#\/popout\/(.+)$/);

  if (popoutMatch) {
    const threadId = decodeURIComponent(popoutMatch[1]);
    return <PopoutConversation threadId={threadId} />;
  }

  return <App />;
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <ThemeProvider defaultTheme="dark">
        <ToastProvider position="bottom-right" defaultDuration={3000}>
          <Root />
        </ToastProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}
