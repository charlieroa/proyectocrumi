export interface ModuleSidebarItem {
    id: string;
    label: string;
    icon: string;
    badge?: number;
    badgeColor?: string;
}

export interface ModuleSidebarSection {
    id: string;
    title: string;
    items: ModuleSidebarItem[];
}

export interface ModuleSidebarConfig {
    sections: ModuleSidebarSection[];
}
