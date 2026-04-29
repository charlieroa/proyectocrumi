import React, { useState } from 'react';
import type { ModuleSidebarSection } from './types';

interface ModuleSidebarProps {
    sections: ModuleSidebarSection[];
    activeItem: string;
    onItemClick: (id: string) => void;
}

const ModuleSidebar: React.FC<ModuleSidebarProps> = ({ sections, activeItem, onItemClick }) => {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const toggle = (sectionId: string) => {
        setCollapsed(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
    };

    // Flat items for mobile pill bar
    const allItems = sections.flatMap(s => s.items);

    return (
        <>
            {/* Desktop sidebar */}
            <nav className="hidden md:block w-[220px] min-w-[220px] shrink-0
                bg-crumi-surface-light dark:bg-crumi-surface-dark
                border-r border-crumi-border-light dark:border-crumi-border-dark
                rounded-crumi shadow-crumi-card">
                <div className="py-3">
                    {sections.map((section) => {
                        const isCollapsed = collapsed[section.id] ?? false;
                        return (
                            <div key={section.id} className="mb-1">
                                {/* Section header */}
                                <button
                                    onClick={() => toggle(section.id)}
                                    className="w-full flex items-center justify-between px-4 py-2
                                        text-[11px] font-semibold uppercase tracking-wider
                                        text-crumi-text-muted dark:text-crumi-text-dark-muted
                                        hover:text-crumi-text-primary dark:hover:text-crumi-text-dark-primary
                                        transition-colors duration-150"
                                >
                                    <span>{section.title}</span>
                                    <i className={`ri-arrow-${isCollapsed ? 'right' : 'down'}-s-line text-[14px] transition-transform duration-200`}></i>
                                </button>

                                {/* Section items */}
                                <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                                    {section.items.map((item) => {
                                        const isActive = activeItem === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => onItemClick(item.id)}
                                                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium
                                                    transition-all duration-150 border-l-[3px]
                                                    ${isActive
                                                        ? 'border-l-crumi-accent bg-crumi-accent/10 text-crumi-accent dark:text-crumi-accent'
                                                        : 'border-l-transparent text-crumi-text-muted dark:text-crumi-text-dark-muted hover:text-crumi-text-primary dark:hover:text-crumi-text-dark-primary hover:bg-crumi-bg-light dark:hover:bg-crumi-surface-dark-hover'
                                                    }`}
                                            >
                                                <i className={`${item.icon} text-[16px]`}></i>
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {item.badge != null && item.badge > 0 && (
                                                    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                                                        text-[11px] font-semibold rounded-full
                                                        ${item.badgeColor === 'danger'
                                                            ? 'bg-crumi-danger/15 text-crumi-danger'
                                                            : 'bg-crumi-warning/15 text-crumi-warning'
                                                        }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </nav>

            {/* Mobile pill bar */}
            <div className="md:hidden flex gap-2 overflow-x-auto pb-3 px-1 scrollbar-none">
                {allItems.map((item) => {
                    const isActive = activeItem === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onItemClick(item.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium
                                whitespace-nowrap transition-all duration-150 shrink-0
                                ${isActive
                                    ? 'bg-crumi-accent text-white shadow-sm'
                                    : 'bg-crumi-surface-light dark:bg-crumi-surface-dark text-crumi-text-muted dark:text-crumi-text-dark-muted border border-crumi-border-light dark:border-crumi-border-dark'
                                }`}
                        >
                            <i className={`${item.icon} text-[14px]`}></i>
                            {item.label}
                            {item.badge != null && item.badge > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1
                                    text-[10px] font-semibold rounded-full
                                    ${isActive
                                        ? 'bg-white/25 text-white'
                                        : 'bg-crumi-warning/15 text-crumi-warning'
                                    }`}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </>
    );
};

export default ModuleSidebar;
