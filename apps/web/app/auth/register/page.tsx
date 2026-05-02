import { Suspense } from 'react';
import RegisterClient from './RegisterClient';

export const dynamic = 'force-dynamic';

function RegisterFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-app px-4">
            <div className="w-full max-w-sm text-center text-xs text-text-muted">
                Loading…
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<RegisterFallback />}>
            <RegisterClient />
        </Suspense>
    );
}
