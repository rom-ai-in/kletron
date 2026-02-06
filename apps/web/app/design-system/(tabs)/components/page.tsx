"use client";

import { useMemo, useState } from "react";
import {
    Plus,
    Mail,
    Zap,
    MoreHorizontal,
} from "lucide-react";

import {
    Button,
    Badge,
    StatusBadge,
    LoadingBadge,
    Input,
    SearchInput,
    PasswordInput,
    Textarea,
    Toggle,
    Switch,
    Checkbox,
    CheckboxGroup,
    CheckboxGroupItem,
    Radio,
    RadioGroup,
    Tabs,
    TabsList,
    TabTrigger,
    TabContent,
    Tooltip,
    ToastProvider,
    useToast,
    Modal,
    Panel,
    Skeleton,
    Card,
    CardHeader,
    CardContent,
    CardFooter,
    StatCard,
    FeatureCard,
    EmptyState,
    LoadingState,
    ErrorState,
    Avatar,
    AvatarGroup,
    ProgressBar,
    CircularProgress,
    Selector,
    SelectableRow,
    ContextMenu,
    Breadcrumbs,
} from "@numezis/ui/components/design-system";

import { DocCard, DocCode, DocRules, DocSection } from "../../components/DocBlocks";
import { InspectButton } from "../../components/Inspector";
import { componentDocs } from "../../docs";

export default function DesignSystemComponentsPage() {
    const [showModal, setShowModal] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const [radioValue, setRadioValue] = useState("daily");
    const [checkValues, setCheckValues] = useState(["alerts"]);
    const [tabsValue, setTabsValue] = useState("overview");
    const [inputValue, setInputValue] = useState("design-system");

    const selectorOptions = useMemo(
        () => [
            { id: "gpt-4o", label: "GPT-4o", sub: "OpenAI flagship model" },
            { id: "claude-3.5", label: "Claude 3.5 Sonnet", sub: "Anthropic latest" },
            { id: "gemini-pro", label: "Gemini Pro", sub: "Google DeepMind" },
            { id: "local", label: "LM Studio", sub: "Local inference" },
        ],
        []
    );

    return (
        <div className="space-y-12">
            <DocSection
                title="Buttons"
                description="Primary actions, secondary actions, and icon-only controls."
            >
                <DocCard title="Variants & Sizes" actions={<InspectButton doc={componentDocs.button} />}>
                    <div className="flex flex-wrap gap-3">
                        <Button variant="primary">Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="danger">Danger</Button>
                        <Button size="xs">XS</Button>
                        <Button size="sm">SM</Button>
                        <Button size="md">MD</Button>
                        <Button size="lg">LG</Button>
                        <Button size="icon"><Plus className="w-4 h-4" /></Button>
                    </div>
                </DocCard>
                <DocCard title="States">
                    <div className="flex flex-wrap gap-3">
                        <Button loading>Loading</Button>
                        <Button disabled>Disabled</Button>
                        <Button variant="secondary" disabled>Disabled Secondary</Button>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use one primary button per view; reserve other actions for secondary/ghost.",
                        "For destructive actions use danger and confirm when impact is large.",
                        "Keep labels verb-first and specific (Save changes, Invite teammate).",
                    ]}
                />
                <DocCode
                    code={`<Button variant="primary">Save changes</Button>
<Button variant="secondary">Cancel</Button>`}
                />
            </DocSection>

            <DocSection
                title="Badges"
                description="Status and semantic indicators, compact enough for tables, lists, and chips."
            >
                <DocCard
                    title="Badge Variants"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.badge} />
                            <InspectButton doc={componentDocs.statusBadge} />
                            <InspectButton doc={componentDocs.loadingBadge} />
                        </div>
                    )}
                >
                    <div className="flex flex-wrap gap-2">
                        <Badge>Default</Badge>
                        <Badge variant="info">Info</Badge>
                        <Badge variant="success">Success</Badge>
                        <Badge variant="warning">Warning</Badge>
                        <Badge variant="error">Error</Badge>
                        <Badge variant="running">Running</Badge>
                    </div>
                </DocCard>
                <DocCard title="Status Badges">
                    <div className="flex flex-wrap gap-2">
                        <StatusBadge status="completed" />
                        <StatusBadge status="running" />
                        <StatusBadge status="paused" />
                        <StatusBadge status="failed" />
                        <StatusBadge status="pending" />
                        <LoadingBadge />
                    </div>
                </DocCard>
                <DocCode
                    code={`<Badge variant="success">Completed</Badge>
<StatusBadge status="failed" />`}
                />
            </DocSection>

            <DocSection
                title="Inputs"
                description="Text input variants, sizes, and stateful feedback."
            >
                <DocCard title="Variants" actions={<InspectButton doc={componentDocs.input} />}>
                    <div className="grid gap-3 md:grid-cols-2">
                        <Input placeholder="Default input" />
                        <Input variant="filled" placeholder="Filled input" />
                        <Input variant="ghost" placeholder="Ghost input" />
                        <Input placeholder="With icon" leftIcon={Mail} />
                        <Input
                            placeholder="Clearable"
                            value={inputValue}
                            onChange={(event) => setInputValue(event.target.value)}
                            clearable
                            onClear={() => setInputValue("")}
                        />
                        <Input placeholder="Success" success />
                        <Input placeholder="Error" error errorMessage="Invalid input" />
                        <Input placeholder="Disabled" disabled />
                    </div>
                </DocCard>
                <DocCard
                    title="Presets"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.searchInput} />
                            <InspectButton doc={componentDocs.passwordInput} />
                        </div>
                    )}
                >
                    <div className="grid gap-3 md:grid-cols-2">
                        <SearchInput placeholder="Search..." />
                        <PasswordInput placeholder="Password" />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use error + errorMessage for validation feedback.",
                        "Prefer SearchInput and PasswordInput presets instead of custom icon wiring.",
                        "Use clearable when the input is filter-like or easy to reset.",
                    ]}
                />
                <DocCode
                    code={`<Input placeholder="Project name" />
<SearchInput placeholder="Search…" />
<PasswordInput placeholder="Password" />`}
                />
            </DocSection>

            <DocSection title="Textarea" description="Multi-line text entry with optional limits.">
                <DocCard title="Textarea States" actions={<InspectButton doc={componentDocs.textarea} />}>
                    <div className="grid gap-3">
                        <Textarea placeholder="Long form input" rows={4} />
                        <Textarea placeholder="With character count" maxLength={140} rows={3} />
                        <Textarea placeholder="Disabled" rows={3} disabled />
                    </div>
                </DocCard>
                <DocCode
                    code={`<Textarea rows={4} placeholder="Describe your request" />`}
                />
            </DocSection>

            <DocSection
                title="Toggles & Switches"
                description="Binary settings and system preferences."
            >
                <DocCard
                    title="Toggle / Switch"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.toggle} />
                            <InspectButton doc={componentDocs.switch} />
                        </div>
                    )}
                >
                    <div className="flex flex-col gap-3">
                        <Toggle label="Enable notifications" />
                        <Toggle label="Dark mode" defaultChecked />
                        <Switch label="Auto-save" size="sm" />
                        <Switch label="Disabled" disabled />
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use toggles for immediate effects and switches for configuration groups.",
                        "Always label toggles; avoid unlabeled switches unless in a table row with a clear label.",
                    ]}
                />
            </DocSection>

            <DocSection title="Checkboxes" description="Multi-select and confirmation controls.">
                <DocCard title="Checkbox States" actions={<InspectButton doc={componentDocs.checkbox} />}>
                    <div className="flex flex-col gap-3">
                        <Checkbox label="Accept terms and conditions" />
                        <Checkbox label="Subscribe to newsletter" defaultChecked />
                        <Checkbox label="Indeterminate" indeterminate />
                        <Checkbox label="Disabled" disabled />
                    </div>
                </DocCard>
                <DocCard
                    title="Checkbox Group"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.checkboxGroup} />
                            <InspectButton doc={componentDocs.checkboxGroupItem} />
                        </div>
                    )}
                >
                    <CheckboxGroup value={checkValues} onChange={setCheckValues} direction="horizontal">
                        <CheckboxGroupItem value="alerts" label="Alerts" />
                        <CheckboxGroupItem value="mentions" label="Mentions" />
                        <CheckboxGroupItem value="weekly" label="Weekly digest" />
                    </CheckboxGroup>
                </DocCard>
                <DocCode
                    code={`<Checkbox label="Accept terms" />
<CheckboxGroup defaultValue={["alerts"]}>
  <CheckboxGroupItem value="alerts" label="Alerts" />
</CheckboxGroup>`}
                />
            </DocSection>

            <DocSection title="Radio" description="Single-select groups.">
                <DocCard
                    title="Radio Group"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.radioGroup} />
                            <InspectButton doc={componentDocs.radio} />
                        </div>
                    )}
                >
                    <RadioGroup name="schedule" value={radioValue} onChange={setRadioValue}>
                        <Radio value="daily" label="Daily" description="Every day at 9am" />
                        <Radio value="weekly" label="Weekly" description="Every Monday" />
                        <Radio value="monthly" label="Monthly" description="First business day" />
                        <Radio value="disabled" label="Disabled" description="Unavailable" disabled />
                    </RadioGroup>
                </DocCard>
                <DocCode
                    code={`<RadioGroup name="plan" defaultValue="weekly">
  <Radio value="weekly" label="Weekly" />
</RadioGroup>`}
                />
            </DocSection>

            <DocSection title="Tabs" description="Switch between content panes with multiple visual styles.">
                <DocCard
                    title="Variants"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.tabs} />
                            <InspectButton doc={componentDocs.tabsList} />
                            <InspectButton doc={componentDocs.tabTrigger} />
                            <InspectButton doc={componentDocs.tabContent} />
                        </div>
                    )}
                >
                    <div className="grid gap-6">
                        <Tabs defaultValue="overview" value={tabsValue} onValueChange={setTabsValue} variant="default">
                            <TabsList>
                                <TabTrigger value="overview">Overview</TabTrigger>
                                <TabTrigger value="activity">Activity</TabTrigger>
                                <TabTrigger value="settings">Settings</TabTrigger>
                            </TabsList>
                            <TabContent value="overview">Overview content</TabContent>
                            <TabContent value="activity">Activity content</TabContent>
                            <TabContent value="settings">Settings content</TabContent>
                        </Tabs>
                        <Tabs defaultValue="p1" variant="pills">
                            <TabsList>
                                <TabTrigger value="p1">Pill One</TabTrigger>
                                <TabTrigger value="p2">Pill Two</TabTrigger>
                            </TabsList>
                            <TabContent value="p1">Pill content</TabContent>
                            <TabContent value="p2">More pill content</TabContent>
                        </Tabs>
                        <Tabs defaultValue="u1" variant="underline">
                            <TabsList>
                                <TabTrigger value="u1">Underline</TabTrigger>
                                <TabTrigger value="u2">Underline 2</TabTrigger>
                            </TabsList>
                        </Tabs>
                        <Tabs defaultValue="s1" variant="segment">
                            <TabsList>
                                <TabTrigger value="s1">Segment A</TabTrigger>
                                <TabTrigger value="s2">Segment B</TabTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </DocCard>
                <DocCode
                    code={`<Tabs defaultValue="overview">
  <TabsList>
    <TabTrigger value="overview">Overview</TabTrigger>
    <TabTrigger value="settings">Settings</TabTrigger>
  </TabsList>
  <TabContent value="overview">...</TabContent>
</Tabs>`}
                />
            </DocSection>

            <DocSection title="Selector" description="Compact dropdown selection for short lists.">
                <DocCard title="Selector Example" actions={<InspectButton doc={componentDocs.selector} />}>
                    <Selector
                        label="Model"
                        value="gpt-4o"
                        options={selectorOptions}
                        onSelect={() => undefined}
                        size="sm"
                    />
                </DocCard>
                <DocCode
                    code={`<Selector label="Model" value="gpt-4o" options={options} onSelect={setValue} />`}
                />
            </DocSection>

            <DocSection title="Breadcrumbs" description="Automatic breadcrumbs from the current route, with overrides.">
                <DocCard
                    title="Breadcrumbs"
                    actions={(
                        <div className="flex items-center gap-2">
                            <InspectButton doc={componentDocs.breadcrumbs} />
                            <InspectButton doc={componentDocs.breadcrumbOverridesProvider} />
                        </div>
                    )}
                >
                    <Breadcrumbs />
                </DocCard>
                <DocCode
                    code={`<BreadcrumbOverridesProvider>
  <Breadcrumbs />
</BreadcrumbOverridesProvider>`}
                />
            </DocSection>

            <DocSection title="Tooltips" description="Contextual hints and label reinforcement.">
                <DocCard title="Tooltip Positions" actions={<InspectButton doc={componentDocs.tooltip} />}>
                    <div className="flex flex-wrap gap-4">
                        <Tooltip content="Top tooltip">
                            <Button variant="secondary">Top</Button>
                        </Tooltip>
                        <Tooltip content="Bottom tooltip" position="bottom">
                            <Button variant="secondary">Bottom</Button>
                        </Tooltip>
                        <Tooltip content="Left tooltip" position="left">
                            <Button variant="secondary">Left</Button>
                        </Tooltip>
                        <Tooltip content="Right tooltip" position="right">
                            <Button variant="secondary">Right</Button>
                        </Tooltip>
                    </div>
                </DocCard>
                <DocRules
                    rules={[
                        "Use tooltips for supplemental info, not essential instructions.",
                        "Keep content short and action-neutral.",
                    ]}
                />
            </DocSection>

            <DocSection title="Toast" description="Transient notifications for system feedback.">
                <ToastProvider position="bottom-right">
                    <ToastDemo />
                </ToastProvider>
                <DocCode
                    code={`const { addToast } = useToast();
addToast({ type: "success", title: "Saved", description: "Changes applied" });`}
                />
            </DocSection>

            <DocSection title="Modal & Panel" description="Overlays and structured containers.">
                <div className="grid gap-4 md:grid-cols-2">
                    <DocCard title="Modal" actions={<InspectButton doc={componentDocs.modal} />}>
                        <Button onClick={() => setShowModal(true)}>Open Modal</Button>
                        <Modal open={showModal} onClose={() => setShowModal(false)} title="Modal Title" subtitle="This is a modal subtitle">
                            <div className="text-sm text-text-secondary">Modal content goes here.</div>
                        </Modal>
                    </DocCard>
                    <DocCard title="Panel" actions={<InspectButton doc={componentDocs.panel} />}>
                        <Panel title="Panel Example" headerAction={<Button size="xs">Action</Button>}>
                            <div className="p-4 text-sm text-text-secondary">Panel content</div>
                        </Panel>
                    </DocCard>
                </div>
                <DocRules
                    rules={[
                        "Use modals for short, interruptive tasks. Keep them under one screen.",
                        "Use panels for persistent content sections and grouped settings.",
                    ]}
                />
            </DocSection>

            <DocSection title="Skeleton" description="Loading placeholders that mimic content structure.">
                <DocCard title="Skeleton Patterns" actions={<InspectButton doc={componentDocs.skeleton} />}>
                    <div className="space-y-2">
                        <Skeleton width="w-3/4" height="h-4" />
                        <Skeleton width="w-1/2" height="h-4" />
                        <Skeleton width="w-2/3" height="h-4" />
                    </div>
                </DocCard>
            </DocSection>

            <DocSection title="Cards" description="Containers for grouped content, stats, and feature highlights.">
                <DocCard
                    title="Card Variations"
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
                                <h3 className="text-sm font-medium text-text-primary">Basic Card</h3>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-text-secondary">Card content goes here.</p>
                            </CardContent>
                            <CardFooter>
                                <Button size="sm">Action</Button>
                            </CardFooter>
                        </Card>
                        <StatCard title="Total Users" value="1,234" change={{ value: "+12.5%", positive: true }} />
                        <FeatureCard icon={Zap} title="Fast Performance" description="Optimized for speed and efficiency." />
                    </div>
                </DocCard>
                <DocCode
                    code={`<Card>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>`}
                />
            </DocSection>

            <DocSection title="Feedback States" description="Empty, loading, and error patterns.">
                <div className="grid gap-4 md:grid-cols-3">
                    <DocCard title="Empty State" actions={<InspectButton doc={componentDocs.emptyState} />}>
                        <EmptyState
                            variant="no-data"
                            title="No items"
                            description="Create your first item to get started."
                            size="sm"
                        />
                    </DocCard>
                    <DocCard title="Loading State" actions={<InspectButton doc={componentDocs.loadingState} />}>
                        <LoadingState message="Loading data..." size="sm" />
                    </DocCard>
                    <DocCard title="Error State" actions={<InspectButton doc={componentDocs.errorState} />}>
                        <ErrorState
                            title="Error"
                            message="Failed to load data."
                            size="sm"
                            onRetry={() => alert("Retrying...")}
                        />
                    </DocCard>
                </div>
            </DocSection>

            <DocSection title="Avatar" description="User identity and group displays.">
                <DocCard title="Sizes" actions={<InspectButton doc={componentDocs.avatar} />}>
                    <div className="flex items-center gap-3">
                        <Avatar name="John Doe" size="xs" />
                        <Avatar name="Jane Smith" size="sm" />
                        <Avatar name="Bob Wilson" size="md" />
                        <Avatar name="Alice Brown" size="lg" />
                        <Avatar name="Tom Davis" size="xl" />
                    </div>
                </DocCard>
                <DocCard title="Avatar Group" actions={<InspectButton doc={componentDocs.avatarGroup} />}>
                    <AvatarGroup max={4}>
                        <Avatar name="John Doe" />
                        <Avatar name="Jane Smith" />
                        <Avatar name="Bob Wilson" />
                        <Avatar name="Alice Brown" />
                        <Avatar name="Tom Davis" />
                        <Avatar name="Chris Evans" />
                    </AvatarGroup>
                </DocCard>
            </DocSection>

            <DocSection title="Progress" description="Visual feedback for long-running processes.">
                <DocCard title="Progress Bar" actions={<InspectButton doc={componentDocs.progressBar} />}>
                    <div className="space-y-3">
                        <ProgressBar value={25} showLabel />
                        <ProgressBar value={60} variant="success" showLabel />
                        <ProgressBar value={90} variant="warning" showLabel />
                    </div>
                </DocCard>
                <DocCard title="Circular Progress" actions={<InspectButton doc={componentDocs.circularProgress} />}>
                    <div className="flex items-center gap-6">
                        <CircularProgress value={25} size={32} />
                        <CircularProgress value={50} size={48} showLabel />
                        <CircularProgress value={75} size={64} showLabel />
                    </div>
                </DocCard>
            </DocSection>

            <DocSection title="Selectable Row" description="Compact selectable list item for settings and navigation.">
                <DocCard title="SelectableRow States" actions={<InspectButton doc={componentDocs.selectableRow} />}>
                    <div className="space-y-2">
                        <SelectableRow label="Default" subLabel="Subtext" />
                        <SelectableRow label="Active" subLabel="Selected item" isActive rightElement={<Badge variant="success">Active</Badge>} />
                        <SelectableRow label="With action" rightElement={<Button size="xs" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>} />
                    </div>
                </DocCard>
            </DocSection>

            <DocSection title="Context Menu" description="Right-click actions for advanced workflows.">
                <DocCard title="Context Menu Demo" description="Right-click inside the box." actions={<InspectButton doc={componentDocs.contextMenu} />}>
                    <div
                        className="rounded-md border border-border-subtle bg-bg-app p-4 text-xs text-text-secondary"
                        onContextMenu={(event) => {
                            event.preventDefault();
                            setContextMenu({ x: event.clientX, y: event.clientY });
                        }}
                    >
                        Right-click here to open the context menu.
                    </div>
                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            onClose={() => setContextMenu(null)}
                            items={[
                                { label: "Open", onClick: () => undefined },
                                { label: "Rename", onClick: () => undefined },
                                { type: "separator" },
                                { label: "Archive", onClick: () => undefined },
                                { label: "Disabled item", onClick: () => undefined, disabled: true },
                                { label: "Delete", onClick: () => undefined, danger: true },
                            ]}
                        />
                    )}
                </DocCard>
                <DocCode
                    code={`<ContextMenu x={x} y={y} items={[{ label: "Open", onClick }]} onClose={close} />`}
                />
            </DocSection>
        </div>
    );
}

function ToastDemo() {
    const { addToast } = useToast();

    return (
        <DocCard title="Toast Variants" actions={<InspectButton doc={componentDocs.toast} />}>
            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    onClick={() =>
                        addToast({
                            type: "success",
                            title: "Saved",
                            description: "Changes applied successfully.",
                        })
                    }
                >
                    Success
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                        addToast({
                            type: "info",
                            title: "Heads up",
                            description: "New version is available.",
                        })
                    }
                >
                    Info
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                        addToast({
                            type: "warning",
                            title: "Be careful",
                            description: "This action cannot be undone.",
                        })
                    }
                >
                    Warning
                </Button>
                <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                        addToast({
                            type: "error",
                            title: "Failed",
                            description: "Could not save changes.",
                        })
                    }
                >
                    Error
                </Button>
            </div>
        </DocCard>
    );
}
