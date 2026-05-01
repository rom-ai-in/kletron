"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "@kletron/ui/components/ui/Card";
import { Button } from "@kletron/ui/components/ui/Button";
import { Plus, Edit, Trash2, Settings, Play, Link as LinkIcon } from "lucide-react";
import { Switch } from "@kletron/ui/components/ui/Toggle";
import { Modal as Dialog } from "@kletron/ui/components/ui/Modal";
import { Selector, type SelectorOption } from "@kletron/ui/components/ui/Selector";

interface Connector {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  config?: Record<string, string>;
}

export default function ConnectorsConfig() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentConnector, setCurrentConnector] = useState<Connector | null>(null);

  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/connectors");
      if (response.ok) {
        const data: Connector[] = await response.json();
        // Add default config for each connector
        const connectorsWithConfig = data.map(conn => ({
          ...conn,
          connected: conn.connected || false,
          config: getDefaultConfig(conn.type)
        }));
        setConnectors(connectorsWithConfig);
      }
    } catch (error) {
      console.error("Error fetching connectors:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultConfig = (type: string): Record<string, string> => {
    switch (type) {
      case "git":
        return { url: "", token: "" };
      case "chat":
        return { webhookUrl: "", apiKey: "" };
      case "storage":
        return { clientId: "", clientSecret: "" };
      default:
        return {};
    }
  };

  const toggleConnector = async (connector: Connector, connected: boolean) => {
    try {
      await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: connector.id,
          connected
        })
      });
      
      setConnectors(connectors.map(c => 
        c.id === connector.id ? { ...c, connected } : c
      ));
    } catch (error) {
      console.error("Error toggling connector:", error);
    }
  };

  const testConnector = async (connector: Connector) => {
    // In a real implementation, this would test the connection
    alert(`Testing ${connector.name}...`);
  };

  const [connectorTypes, setConnectorTypes] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchConnectorTypes();
  }, []);

  const fetchConnectorTypes = async () => {
    try {
      const response = await fetch("/api/connector-types");
      if (response.ok) {
        const data: { id: string; name: string }[] = await response.json();
        setConnectorTypes(data);
      }
    } catch (error) {
      console.error("Error fetching connector types:", error);
    }
  };

  const handleAddConnector = () => {
    setCurrentConnector(null);
    setAddDialogOpen(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-text-primary mb-2">Connectors</h1>
      <p className="text-text-muted mb-8">Manage external service integrations</p>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-text-muted">Loading connectors...</p>
        </div>
      ) : connectors.length > 0 ? (
        <div className="space-y-4 mb-6">
          {connectors.map((connector) => (
            <Card key={connector.id} className="border-border-subtle bg-bg-surface">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-text-primary font-medium">{connector.name}</span>
                      <span className="text-xs text-text-muted ml-2">({connector.type})</span>
                    </div>
                    <p className="text-xs text-text-muted">Status: {connector.connected ? "Connected" : "Disconnected"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={connector.connected}
                      onChange={(checked) => toggleConnector(connector, checked)}
                    />
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => testConnector(connector)}
                      className="h-8 w-8 p-0"
                      title="Test connection"
                    >
                      <Play className="h-4 w-4 text-status-success-text" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted italic mb-6">No connectors configured</p>
      )}

      <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={handleAddConnector}>
        <Plus className="h-4 w-4" />
        Add Connector
      </Button>

      {/* Add Connector Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title="">
        <div className="py-4">
          <h3 className="text-lg font-semibold text-text-primary mb-2">Add New Connector</h3>
          <p className="text-sm text-text-muted mb-4">Select a connector type to configure:</p>
          {connectorTypes.length > 0 ? (
            <Selector
              label="Connector"
              value={connectorTypes[0].id}
              options={connectorTypes.map(type => ({ id: type.id, label: type.name }))}
              onSelect={() => alert("Connector added!")}
              fullWidth
            />
          ) : (
            <p className="text-sm text-text-muted">No connector types available</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle">
          <Button variant="secondary" onClick={() => setAddDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => alert("Connector added!")}>
            Add Connector
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
