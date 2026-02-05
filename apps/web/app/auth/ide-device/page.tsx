import { Suspense } from 'react';
import IdeDeviceClient from './IdeDeviceClient';

export const dynamic = 'force-dynamic';

function DeviceFallback() {
    return (
        <div className="min-h-screen bg-bg-app flex items-center justify-center p-6">
            <div className="w-full max-w-md text-center text-xs text-text-muted">
                Loading device sign-in…
            </div>
        </div>
    );
}

export default function IDEDevicePage() {
    return (
        <Suspense fallback={<DeviceFallback />}>
            <IdeDeviceClient />
        </Suspense>
    );
}
