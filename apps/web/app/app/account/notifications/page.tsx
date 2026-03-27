'use client';

import { useState } from 'react';
import {
    Bell,
    Mail,
    Shield,
    Megaphone,
    Package,
    Check,
    AlertCircle
} from 'lucide-react';
import { Button, Switch } from '@kletron/ui/components/design-system';

interface NotificationSetting {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    enabled: boolean;
    category: 'security' | 'product' | 'marketing';
}

export default function NotificationsPage() {
    const [settings, setSettings] = useState<NotificationSetting[]>([
        {
            id: 'security_alerts',
            title: 'Security Alerts',
            description: 'Critical security notifications (cannot be disabled)',
            icon: Shield,
            enabled: true,
            category: 'security',
        },
        {
            id: 'login_notifications',
            title: 'New Login Notifications',
            description: 'Get notified when your account is accessed from a new device',
            icon: AlertCircle,
            enabled: true,
            category: 'security',
        },
        {
            id: 'product_updates',
            title: 'Product Updates',
            description: 'New features, improvements, and changelog updates',
            icon: Package,
            enabled: true,
            category: 'product',
        },
        {
            id: 'usage_reports',
            title: 'Weekly Usage Reports',
            description: 'Summary of your AI usage and token consumption',
            icon: Bell,
            enabled: false,
            category: 'product',
        },
        {
            id: 'marketing_emails',
            title: 'Marketing Communications',
            description: 'Tips, tutorials, and promotional offers',
            icon: Megaphone,
            enabled: false,
            category: 'marketing',
        },
        {
            id: 'newsletter',
            title: 'Kletron Newsletter',
            description: 'Monthly newsletter with AI development insights',
            icon: Mail,
            enabled: false,
            category: 'marketing',
        },
    ]);

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const toggleSetting = (id: string) => {
        // Security alerts cannot be disabled
        if (id === 'security_alerts') return;

        setSettings(settings.map(s =>
            s.id === id ? { ...s, enabled: !s.enabled } : s
        ));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        // TODO: Implement save to API
        await new Promise(resolve => setTimeout(resolve, 1000));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const securitySettings = settings.filter(s => s.category === 'security');
    const productSettings = settings.filter(s => s.category === 'product');
    const marketingSettings = settings.filter(s => s.category === 'marketing');

    const SettingRow = ({ setting }: { setting: NotificationSetting }) => {
        const Icon = setting.icon;
        const isLocked = setting.id === 'security_alerts';

        return (
            <div
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${setting.enabled
                        ? 'border-border-subtle bg-bg-elevated'
                        : 'border-border-subtle/50 bg-bg-surface'
                    }`}
            >
                <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${setting.enabled ? 'bg-status-success-bg' : 'bg-bg-elevated'
                        }`}>
                        <Icon className={`w-4 h-4 ${setting.enabled ? 'text-status-success-text' : 'text-text-muted'}`} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-text-primary">{setting.title}</p>
                        <p className="text-[11px] text-text-muted">{setting.description}</p>
                    </div>
                </div>
                <Switch
                    checked={setting.enabled}
                    onChange={(checked) => {
                        if (!isLocked) {
                            toggleSetting(setting.id);
                        }
                    }}
                    disabled={isLocked}
                />
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="p-6 rounded-lg border border-border-subtle bg-bg-surface">
                <div className="flex items-center gap-3 mb-2">
                    <Bell className="w-5 h-5 text-text-muted" />
                    <h2 className="text-lg font-semibold text-text-primary">Notification Preferences</h2>
                </div>
                <p className="text-sm text-text-muted">
                    Control which emails and notifications you receive from Kletron.
                </p>
            </div>

            {/* Security Notifications */}
            <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted px-1">
                    Security (Required)
                </h3>
                {securitySettings.map(setting => (
                    <SettingRow key={setting.id} setting={setting} />
                ))}
            </div>

            {/* Product Notifications */}
            <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted px-1">
                    Product Updates
                </h3>
                {productSettings.map(setting => (
                    <SettingRow key={setting.id} setting={setting} />
                ))}
            </div>

            {/* Marketing Notifications */}
            <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted px-1">
                    Marketing (Consent Required)
                </h3>
                {marketingSettings.map(setting => (
                    <SettingRow key={setting.id} setting={setting} />
                ))}

                <div className="p-3 rounded-md bg-bg-elevated border border-border-subtle">
                    <p className="text-[11px] text-text-muted">
                        <strong className="text-text-secondary">GDPR Notice:</strong> Marketing emails require your explicit consent.
                        You can withdraw consent at any time by toggling these settings off.
                    </p>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    loading={saving}
                    className="w-full"
                >
                    Save Preferences
                </Button>
                {saved && (
                    <div className="flex items-center gap-1.5 text-status-success-text text-xs">
                        <Check className="w-4 h-4" />
                        Preferences saved
                    </div>
                )}
            </div>

            {/* Unsubscribe from all */}
            <div className="p-4 rounded-lg border border-border-subtle bg-bg-surface">
                <p className="text-xs text-text-secondary">
                    <strong className="text-text-primary">Want to unsubscribe from all marketing?</strong>{' '}
                    <Button
                        onClick={() => {
                            setSettings(settings.map(s =>
                                s.category === 'marketing' ? { ...s, enabled: false } : s
                            ));
                        }}
                        variant="secondary"
                        size="sm"
                        className="text-status-success-text hover:underline"
                    >
                        Click here to disable all marketing emails
                    </Button>
                </p>
            </div>
        </div>
    );
}
