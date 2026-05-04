"use client";

import { Card, CardHeader, CardContent } from "@kletron/ui/components/design-system";
import { WORK_MODES, type WorkModeId } from "@kletron/shared/workMode";

const ORDER: WorkModeId[] = ["code", "work"];

export default function WorkModesConfigPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary">Code vs Work</h1>
        <p className="text-text-muted mt-2">
          Kletron uses two modes. The active mode is stored for your workspace and sent with agent
          sessions so tools and prompts stay consistent. Switch mode from the app header or desktop
          command bar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ORDER.map((id) => {
          const w = WORK_MODES[id];
          return (
            <Card key={id} className="border-border-subtle bg-bg-surface">
              <CardHeader>
                <h2 className="text-lg font-semibold text-text-primary">{w.name}</h2>
                <p className="text-sm text-text-muted">{w.description}</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h3 className="font-medium text-text-muted mb-2">Typical tools</h3>
                  <ul className="space-y-1">
                    {w.availableTools.map((t) => (
                      <li key={t} className="flex items-center gap-2 text-text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-success shrink-0" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-text-muted mb-2">Connectors</h3>
                  <p className="text-text-secondary">
                    {w.connectors.length > 0 ? w.connectors.join(", ") : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
