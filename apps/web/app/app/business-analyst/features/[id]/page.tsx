"use client";

import { BAFeatureDetailView } from "@numezis/ui/components/ba/BAFeatureDetailView";

export default function BAFeatureDetailPage({ params }: { params: { id: string } }) {
    return <BAFeatureDetailView featureId={params.id} />;
}
