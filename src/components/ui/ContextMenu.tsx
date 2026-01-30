"use client";

import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
}

export interface ContextMenuSeparator {
    type: 'separator';
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuEntry[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        // Delay adding listener to avoid immediate close from right-click
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let adjustedX = x;
            let adjustedY = y;

            if (x + rect.width > viewportWidth) {
                adjustedX = viewportWidth - rect.width - 8;
            }
            if (y + rect.height > viewportHeight) {
                adjustedY = viewportHeight - rect.height - 8;
            }

            menuRef.current.style.left = `${adjustedX}px`;
            menuRef.current.style.top = `${adjustedY}px`;
        }
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] py-1 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl"
            style={{ left: x, top: y }}
        >
            {items.map((item, index) => {
                if ('type' in item && item.type === 'separator') {
                    return (
                        <div
                            key={`sep-${index}`}
                            className="my-1 border-t border-zinc-700"
                        />
                    );
                }

                const menuItem = item as ContextMenuItem;
                return (
                    <button
                        key={index}
                        className={`
                            w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
                            transition-colors
                            ${menuItem.disabled
                                ? 'text-zinc-500 cursor-not-allowed'
                                : menuItem.danger
                                    ? 'text-red-400 hover:bg-red-900/30'
                                    : 'text-zinc-200 hover:bg-zinc-700'
                            }
                        `}
                        onClick={() => {
                            if (!menuItem.disabled) {
                                menuItem.onClick();
                                onClose();
                            }
                        }}
                        disabled={menuItem.disabled}
                    >
                        {menuItem.icon && (
                            <span className="w-4 h-4 flex items-center justify-center opacity-70">
                                {menuItem.icon}
                            </span>
                        )}
                        {menuItem.label}
                    </button>
                );
            })}
        </div>
    );
};
