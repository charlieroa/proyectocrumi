import React from 'react';
import ModuleSidebar from './ModuleSidebar';
import type { ModuleSidebarSection } from './types';

interface ModuleLayoutProps {
    sections: ModuleSidebarSection[];
    activeItem: string;
    onItemClick: (id: string) => void;
    children: React.ReactNode;
    title?: string;
}

const ModuleLayout: React.FC<ModuleLayoutProps> = ({ sections, activeItem, onItemClick, children }) => {
    return (
        <div className="md:flex md:gap-4 relative" style={{ zIndex: 1 }}>
            <ModuleSidebar sections={sections} activeItem={activeItem} onItemClick={onItemClick} />
            <div className="flex-1 min-w-0">
                {children}
            </div>
        </div>
    );
};

export default ModuleLayout;
