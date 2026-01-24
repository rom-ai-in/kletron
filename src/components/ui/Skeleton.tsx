import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Width of the skeleton (e.g., 'w-32', 'w-full') */
    width?: string;
    /** Height of the skeleton (e.g., 'h-4', 'h-10') */
    height?: string;
    /** Optional border radius class (e.g., 'rounded', 'rounded-full') */
    radius?: string;
}

/**
 * Generic skeleton placeholder component.
 * Uses Tailwind CSS utilities to render a pulsating block.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    width = 'w-full',
    height = 'h-4',
    radius = 'rounded',
    className = '',
    ...props
}) => {
    return (
        <div
            className={`bg-bg-elevated animate-pulse ${width} ${height} ${radius} ${className}`}
            {...props}
        />
    );
};
