import { Suspense } from 'react';
import IdeCallbackClient from './IdeCallbackClient';

export const dynamic = 'force-dynamic';

function CallbackFallback() {
    return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center text-xs text-text-muted">
                Loading IDE callback…
            </div>
        </div>
    );
}

export default function IDECallbackPage() {
    return (
        <Suspense fallback={<CallbackFallback />}>
            <IdeCallbackClient />
        </Suspense>
    );
}
