import { odooService } from '@/app/services/odooService';
import DashboardClient from './DashboardClient';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // In a real app with proper session management, we would get the user from the session
    // For now, we will assume a default user or handle the redirect on client if no auth
    // But since this is a server component, we need to pass data to the client

    // MOCK USER for Server Side Rendering context if needed, 
    // but actual auth validation happens in Client or Middleware.
    // Here we just fetch the stats assuming a user ID (e.g., 2) for the prototype

    try {
        const stats = await odooService.getDetailedSalesStats(2);

        // We'll pass a mock user object to the client component for now
        // The client component will likely re-verify auth context
        const mockUser = {
            uid: 2,
            name: "Vendedor Demo",
            username: "vendedor",
            session_id: "mock-session",
            partner_id: 10,
            company_id: 1,
            is_system: false
        };

        return <DashboardClient user={mockUser} stats={stats} />;
    } catch (error) {
        console.error("Dashboard Error:", error);
        return <div className="p-8 text-center text-red-500">Error cargando el dashboard. Por favor intente más tarde.</div>;
    }
}
