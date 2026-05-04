// apps/web/components/cowork/OnboardingFlow.tsx
"use client";

import { useState, useEffect } from "react";
import { DEFAULT_WORK_CATEGORIES } from "@kletron/shared";
import type { WorkCategory } from "@kletron/shared";

interface OnboardingState {
    step: number;
    selectedPrimaryUse: string;
    completed: boolean;
}

interface UserPreferences {
    primaryUse: string;
    selectedCategories: string[];
    completedOnboarding: boolean;
    onboardingDate: string | null;
}

/**
 * CoWork onboarding flow
 */
export function OnboardingFlow() {
    const [state, setState] = useState<OnboardingState>({
        step: 0,
        selectedPrimaryUse: '',
        completed: false
    });

    // Check if onboarding already completed
    useEffect(() => {
        const saved = localStorage.getItem('kletron-onboarding');
        if (saved) {
            const prefs: UserPreferences = JSON.parse(saved);
            if (prefs.completedOnboarding) {
                setState(prev => ({ ...prev, completed: true }));
            }
        }
    }, []);

    if (state.completed) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface border border-subtle rounded-lg p-8 max-w-2xl w-full mx-4">
                {state.step === 0 && (
                    <WelcomeStep
                        onNext={() => setState(prev => ({ ...prev, step: 1 }))}
                    />
                )}
                {state.step === 1 && (
                    <PrimaryUseStep
                        selectedUse={state.selectedPrimaryUse}
                        onSelect={(use) => setState(prev => ({ ...prev, selectedPrimaryUse: use }))}
                        onNext={() => setState(prev => ({ ...prev, step: 2 }))}
                        onSkip={() => completeOnboarding('general')}
                    />
                )}
                {state.step === 2 && (
                    <CategorySelectionStep
                        selectedUse={state.selectedPrimaryUse}
                        onComplete={handleComplete}
                        onSkip={() => completeOnboarding(state.selectedPrimaryUse || 'general')}
                    />
                )}
            </div>
        </div>
    );

    function handleComplete(selectedCategories: string[]) {
        completeOnboarding(state.selectedPrimaryUse || 'general', selectedCategories);
    }

    function completeOnboarding(primary: string, additionalCategories?: string[]) {
        const prefs: UserPreferences = {
            primaryUse: primary,
            selectedCategories: additionalCategories || [primary],
            completedOnboarding: true,
            onboardingDate: new Date().toISOString()
        };

        localStorage.setItem('kletron-onboarding', JSON.stringify(prefs));
        localStorage.setItem(`kletron-category-default`, primary);
        setState(prev => ({ ...prev, completed: true }));

        // Track onboarding completion
        trackEvent('onboarding_completed', { primaryUse: primary });
    }
}

/**
 * Welcome step
 */
function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">
                Welcome to Kletron CoWork
            </h2>
            <p className="text-subtle mb-8">
                Switch between work categories: coding, document drafting, automation, and more.
                Let's set up your workspace.
            </p>
            <button
                onClick={onNext}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover"
            >
                Get Started
            </button>
        </div>
    );
}

/**
 * Primary use step
 */
function PrimaryUseStep({
    selectedUse,
    onSelect,
    onNext,
    onSkip
}: {
    selectedUse: string;
    onSelect: (use: string) => void;
    onNext: () => void;
    onSkip: () => void;
}) {
    return (
        <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
                What will you use most?
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
                {DEFAULT_WORK_CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        onClick={() => onSelect(category.id)}
                        className={`p-6 border rounded-lg text-left transition-all ${
                            selectedUse === category.id
                                ? 'border-primary bg-primary/10'
                                : 'border-subtle hover:border-primary/50'
                        }`}
                    >
                        <span className="text-3xl mb-2 block">{category.icon}</span>
                        <h3 className="font-semibold text-foreground mb-1">{category.name}</h3>
                        <p className="text-sm text-subtle">{category.description}</p>
                    </button>
                ))}
            </div>
            <div className="flex justify-between">
                <button onClick={onSkip} className="text-subtle hover:text-foreground">
                    Skip
                </button>
                <button
                    onClick={onNext}
                    disabled={!selectedUse}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

/**
 * Category selection step
 */
function CategorySelectionStep({
    selectedUse,
    onComplete,
    onSkip
}: {
    selectedUse: string;
    onComplete: (categories: string[]) => void;
    onSkip: () => void;
}) {
    const [selected, setSelected] = useState<string[]>([selectedUse]);

    const toggleCategory = (categoryId: string) => {
        setSelected(prev =>
            prev.includes(categoryId)
                ? prev.filter(c => c !== categoryId)
                : [...prev, categoryId]
        );
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">
                Select your categories
            </h2>
            <p className="text-subtle mb-6">Choose the categories you want to use</p>
            <div className="space-y-3 mb-8">
                {DEFAULT_WORK_CATEGORIES.map(category => (
                    <label
                        key={category.id}
                        className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                            selected.includes(category.id)
                                ? 'border-primary bg-primary/10'
                                : 'border-subtle hover:border-primary/50'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(category.id)}
                            onChange={() => toggleCategory(category.id)}
                            className="sr-only"
                        />
                        <span className="text-2xl">{category.icon}</span>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{category.name}</h3>
                            <p className="text-sm text-subtle">{category.description}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selected.includes(category.id) ? 'border-primary bg-primary' : 'border-subtle'
                        }`}>
                            {selected.includes(category.id) && (
                                <svg className="w-3 h-3 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </label>
                ))}
            </div>
            <div className="flex justify-between">
                <button onClick={onSkip} className="text-subtle hover:text-foreground">
                    Skip
                </button>
                <button
                    onClick={() => onComplete(selected)}
                    disabled={selected.length === 0}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                    Complete Setup
                </button>
            </div>
        </div>
    );
}

/**
 * Analytics tracking
 */
interface AnalyticsEvent {
    eventType: string;
    category?: string;
    previousCategory?: string;
    duration?: number;
    metadata?: Record<string, unknown>;
    timestamp?: number;
}

let eventQueue: AnalyticsEvent[] = [];

function trackEvent(eventType: string, metadata?: Record<string, unknown>) {
    const event: AnalyticsEvent = {
        eventType,
        metadata,
        timestamp: Date.now()
    };

    eventQueue.push(event);

    // Flush events periodically
    if (eventQueue.length >= 5) {
        flushEvents();
    }
}

async function flushEvents() {
    if (eventQueue.length === 0) return;

    const events = [...eventQueue];
    eventQueue = [];

    try {
        await fetch('/api/analytics/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });
    } catch (error) {
        console.error('Failed to send analytics:', error);
        // Keep events for retry
        eventQueue = [...events, ...eventQueue];
    }
}

// Add timestamp to AnalyticsEvent
type AnalyticsEventWithTimestamp = AnalyticsEvent & { timestamp: number };
