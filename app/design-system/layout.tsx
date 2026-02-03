"use client";

import { useState, ReactNode } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

const CORRECT_PASSWORD = "numezis2026";

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
    const [password, setPassword] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === CORRECT_PASSWORD) {
            setIsAuthenticated(true);
            setError("");
        } else {
            setError("Invalid password");
            setPassword("");
        }
    };

    if (isAuthenticated) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center p-6">
            <div className="w-full max-w-sm">
                <div className="p-6 rounded-xl border border-border-subtle bg-bg-surface">
                    <div className="flex items-center justify-center mb-6">
                        <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
                            <Lock className="w-6 h-6 text-text-muted" />
                        </div>
                    </div>

                    <h1 className="text-lg font-semibold text-text-primary text-center mb-2">
                        Design System
                    </h1>
                    <p className="text-xs text-text-muted text-center mb-6">
                        Protected area. Enter password to continue.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full px-4 py-3 pr-10 rounded-lg border border-border-subtle bg-bg-elevated text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-border-strong transition-colors"
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {error && (
                            <p className="text-xs text-rose-400 text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="w-full py-3 rounded-lg bg-text-primary text-bg-app text-sm font-medium hover:bg-text-secondary transition-colors"
                        >
                            Access Design System
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
