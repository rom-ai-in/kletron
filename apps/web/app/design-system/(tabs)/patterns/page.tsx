"use client";

import { useState } from "react";
import { Folder, MoreHorizontal, Plus, Zap } from "lucide-react";

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardContent,
    CardFooter,
    EmptyState,
    Panel,
    SelectableRow,
    Switch,
    Input,
    Textarea,
    Checkbox,
    Tabs,
    TabsList,
    TabTrigger,
    TabContent,
} from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

export default function DesignSystemPatternsPage() {
    const [tab, setTab] = useState("details");
    const [formState, setFormState] = useState({
        name: "Design System",
        description: "Shared UI primitives for Numezis",
        approvals: true,
        notify: false,
    });

    return (
        <div className="space-y-12">
            <DocSection
                title="Card Patterns"
                description="Reusable card compositions for summaries, lists, and actionable content."
            >
                <DocCard
                    title="Card Patterns"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.card} />
                            <InspectButton doc={componentDocs.statCard} />
                            <InspectButton doc={componentDocs.featureCard} />
                        </div>
                    )}
                >
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <h3 className="text-sm font-medium text-text-primary">Feature Card</h3>
                            </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <Zap className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-text-secondary">Automation</p>
                                    <p className="text-sm text-text-primary font-medium">Fast approvals</p>
                                </div>
                            </div>
                            <p className="text-xs text-text-secondary">Automate low-risk edits to move faster.</p>
                        </CardContent>
                        <CardFooter>
                            <Button size="sm">Enable</Button>
                        </CardFooter>
                    </Card>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-text-primary">Stat Card</h3>
                                <Badge variant="success">+12%</Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-text-primary">1,234</p>
                            <p className="text-xs text-text-muted">Total items</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-text-primary">User Card</h3>
                                    <p className="text-[10px] text-text-muted">user@example.com</p>
                                </div>
                                <Button size="xs" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-text-secondary">Team lead · 5 projects</p>
                        </CardContent>
                    </Card>
                </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use cards for grouped content or to elevate summary metrics.",
                        "Keep card headers concise and left-aligned.",
                        "Use badges for tiny status indicators, not large paragraphs.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="Empty & First-Run Patterns"
                description="Guide users to the next action when no data is present."
            >
                <DocCard title="Empty State" actions={<InspectButton doc={componentDocs.emptyState} />}>
                    <EmptyState
                        variant="no-data"
                        title="No items found"
                        description="Create your first item to get started."
                        action={{ label: "Create item", onClick: () => undefined }}
                    />
                </DocCard>
                <DocCard title="Simple Empty Card" actions={<InspectButton doc={componentDocs.button} />}>
                    <div className="p-8 rounded-lg border border-border-subtle bg-bg-surface text-center">
                        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center">
                            <Folder className="w-6 h-6 text-text-muted" />
                        </div>
                        <h4 className="text-sm font-medium text-text-primary mb-1">No items found</h4>
                        <p className="text-xs text-text-muted mb-4">Get started by creating your first item.</p>
                        <Button><Plus className="w-4 h-4 mr-2" />Create Item</Button>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Always include a primary action for empty states.",
                        "Keep empty state text concise and supportive.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="Settings Panels"
                description="Pattern for toggles, labels, and descriptive copy in a consistent layout."
            >
                <DocCard title="Settings Panel" actions={<InspectButton doc={componentDocs.panel} />}>
                    <Panel title="Workspace Preferences">
                        <div className="border-b border-border-subtle px-4 py-3 text-xs text-text-muted">
                            Tune the agent experience without leaving the app.
                        </div>
                        <div className="divide-y divide-border-subtle">
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium text-text-primary">Auto-approve safe edits</div>
                                    <div className="text-xs text-text-muted">Skip confirmations for low-risk changes.</div>
                                </div>
                                <Switch size="sm" checked={formState.approvals} onChange={(checked) => setFormState((prev) => ({ ...prev, approvals: checked }))} />
                            </div>
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <div>
                                    <div className="text-sm font-medium text-text-primary">Smart notifications</div>
                                    <div className="text-xs text-text-muted">Only alert when the agent needs input.</div>
                                </div>
                                <Switch size="sm" checked={formState.notify} onChange={(checked) => setFormState((prev) => ({ ...prev, notify: checked }))} />
                            </div>
                        </div>
                    </Panel>
                </DocCard>
                <DocCode
                    code={`<Panel title="Workspace Preferences">
  <div className="divide-y">...</div>
</Panel>`}
                />
            </DocSection>

            <DocSection
                title="Form Layouts"
                description="Pattern for grouped inputs with context and validation."
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <DocCard
                        title="Single Column"
                        actions={(
                            <div className="flex items-center gap-2">
                                <InspectButton doc={componentDocs.input} />
                                <InspectButton doc={componentDocs.textarea} />
                                <InspectButton doc={componentDocs.checkbox} />
                            </div>
                        )}
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-text-secondary">Project name</div>
                                <Input
                                    placeholder="Design System"
                                    value={formState.name}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                                />
                            </div>
                            <Textarea
                                placeholder="Description"
                                rows={4}
                                value={formState.description}
                                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                            />
                            <Checkbox
                                label="Require approvals"
                                checked={formState.approvals}
                                onChange={(checked) => setFormState((prev) => ({ ...prev, approvals: checked }))}
                            />
                            <Button>Save changes</Button>
                        </div>
                    </DocCard>
                    <DocCard
                        title="Tabbed Form"
                        actions={(
                            <div className="flex items-center gap-2">
                                <InspectButton doc={componentDocs.tabs} />
                                <InspectButton doc={componentDocs.tabTrigger} />
                                <InspectButton doc={componentDocs.tabContent} />
                            </div>
                        )}
                    >
                        <Tabs defaultValue="details" value={tab} onValueChange={setTab} variant="segment">
                            <TabsList>
                                <TabTrigger value="details">Details</TabTrigger>
                                <TabTrigger value="access">Access</TabTrigger>
                            </TabsList>
                            <TabContent value="details">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="text-xs font-medium text-text-secondary">Project name</div>
                                        <Input placeholder="Project name" value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} />
                                    </div>
                                    <Textarea placeholder="Description" rows={3} />
                                </div>
                            </TabContent>
                            <TabContent value="access">
                                <div className="space-y-3">
                                    <Checkbox label="Members can invite others" />
                                    <Checkbox label="Require approval for edits" defaultChecked />
                                </div>
                            </TabContent>
                        </Tabs>
                    </DocCard>
                </div>
                <DocRules
                    rules={[
                        "Keep forms single-column unless fields are short and logically paired.",
                        "Group advanced settings under tabs or collapsible sections.",
                    ]}
                />
            </DocSection>

            <DocSection
                title="List Patterns"
                description="Selectable rows for list views, navigation, or settings groups."
            >
                <DocCard title="Selectable Rows" actions={<InspectButton doc={componentDocs.selectableRow} />}>
                    <div className="space-y-2">
                        <SelectableRow label="General" subLabel="Workspace defaults" isActive />
                        <SelectableRow label="Notifications" subLabel="Alerts and badges" />
                        <SelectableRow label="Security" subLabel="Access policies" rightElement={<Badge variant="warning">Requires review</Badge>} />
                    </div>
                </DocCard>
                <DocCode
                    code={`<SelectableRow label="General" subLabel="Workspace defaults" isActive />`}
                />
            </DocSection>
        </div>
    );
}
