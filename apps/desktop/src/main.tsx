import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import PopoutConversation from "./app/PopoutConversation";
import { ThemeProvider } from "@numezis/ui/hooks/useTheme";
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
        <Root />
      </ThemeProvider>
    </React.StrictMode>
  );
}
