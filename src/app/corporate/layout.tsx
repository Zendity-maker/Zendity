import { Metadata } from 'next';
import CorporateSidebar from './_components/CorporateSidebar';
import CorporateTopbar from './_components/CorporateTopbar';

export const metadata: Metadata = {
    title: 'Zendity | Corporate Dashboard',
    description: 'Zendity Global Management Dashboard',
};

export default function CorporateLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
            {/* Sidebar */}
            <CorporateSidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Topbar */}
                <CorporateTopbar />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto w-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
