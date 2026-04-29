import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { getTenantIdFromToken } from '../services/auth';
import logoWhite from '../assets/images/logo/logowhite.png';

export interface TenantLogoData {
  tenantLogo: string | null;
  tenantName: string;
  loading: boolean;
}

/**
 * Hook para obtener el logo y nombre del tenant actual.
 * Si no hay logo configurado, retorna null para tenantLogo.
 */
export const useTenantLogo = (): TenantLogoData => {
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('Mi Empresa');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const tenantId = getTenantIdFromToken();
        if (!tenantId) {
          setLoading(false);
          return;
        }

        const { data } = await api.get(`/tenants/${tenantId}`);
        
        if (data) {
          setTenantName(data.name || 'Mi Empresa');
          
          if (data.logo_url) {
            // Construir URL completa si es relativa
            const baseUrl = api.defaults.baseURL || '';
            const fullLogoUrl = data.logo_url.startsWith('http') 
              ? data.logo_url 
              : `${baseUrl}${data.logo_url}`;
            setTenantLogo(fullLogoUrl);
          } else {
            setTenantLogo(null);
          }
        }
      } catch (error) {
        console.error('Error fetching tenant logo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, []);

  return { tenantLogo, tenantName, loading };
};

export default useTenantLogo;
