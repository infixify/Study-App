// app/groups/[id]/page.tsx
import { notFound } from 'next/navigation';

// This is a server component that wraps the client component
// We need generateStaticParams for static export, but since we can't fetch
// all group IDs at build time, we'll use dynamicParams: false and handle
// the client-side rendering

export async function generateStaticParams() {
  // For static export, we can't fetch from Supabase at build time
  // So we return empty array and let the page handle it client-side
  return [];
}

export const dynamicParams = false;

// Now import and render the client component
import GroupDetailClient from './GroupDetailClient';

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  // In static export mode, we can't use dynamic routes without generateStaticParams
  // So we'll just render the client component which will handle everything
  return <GroupDetailClient />;
}
