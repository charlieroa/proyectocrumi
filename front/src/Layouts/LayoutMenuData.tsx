import React, { useEffect, useMemo, useState } from 'react';
import { getRoleFromToken, isContadorFullMode, getTenantIdFromToken } from '../services/auth';
import { getSidebarEntriesForRole } from '../config/erpModuleMap';
import { api } from '../services/api';

const LayoutMenuData = () => {
  const userRole = getRoleFromToken();
  const [isMainTenant, setIsMainTenant] = useState<boolean>(false);
  const [isAccountantMode, setIsAccountantMode] = useState<boolean>(false);

  useEffect(() => {
    const tid = getTenantIdFromToken();
    if (!tid) return;
    (async () => {
      try {
        const res: any = await api.get(`/tenants/${tid}`);
        const data = res?.data ?? res;
        setIsMainTenant(!!data?.is_main_tenant);
        setIsAccountantMode(!!data?.is_accountant_mode);
      } catch {
        // silent
      }
    })();
  }, []);

  const finalMenuItems = useMemo(() => {
    if (!userRole) {
      return [];
    }

    const effectiveRole = userRole as 1 | 2 | 3 | 4 | 99;
    const isTenantInContadorMode = effectiveRole === 1 && isContadorFullMode();
    const isContadorInTenantMode = effectiveRole === 4 && !isContadorFullMode();
    const accountantOk = isAccountantMode || isMainTenant || effectiveRole === 4 || effectiveRole === 99;

    const filtered = getSidebarEntriesForRole(effectiveRole).filter((item: any) => {
      if (item.isHeader) return true;
      if (item.requiresMainTenant && !isMainTenant) return false;
      if (item.requiresAccountantMode && !accountantOk) return false;
      if (isTenantInContadorMode && item.id === 'kanban') return true;
      if (isContadorInTenantMode && item.id === 'kanban') return false;
      return true;
    });

    const result: any[] = [];
    for (let i = 0; i < filtered.length; i += 1) {
      const item = filtered[i];
      if (item.isHeader) {
        const hasItemsAfter = filtered.slice(i + 1).some((nextItem) => !nextItem.isHeader);
        if (hasItemsAfter) {
          result.push(item);
        }
        continue;
      }

      result.push({
        id: item.id,
        label: item.label,
        icon: item.icon,
        link: item.link,
        roles: item.roles,
        isHeader: item.isHeader,
        status: item.status,
        domainId: item.domainId,
        isDisabled: !item.link,
      });
    }

    return result;
  }, [userRole, isMainTenant, isAccountantMode]);

  return <React.Fragment>{finalMenuItems}</React.Fragment>;
};

export default LayoutMenuData;
