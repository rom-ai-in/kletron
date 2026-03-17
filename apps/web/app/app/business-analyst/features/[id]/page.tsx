"use client";

import { BAFeatureDetailView } from "@kletron/ui/components/ba/BAFeatureDetailView";

export default function BAFeatureDetailPage({ params }: { params: { id: string } }) {
    return <BAFeatureDetailView featureId={params.id} />;
}
