import React from 'react';
import { Button, Container } from 'reactstrap';
import { useNavigate } from 'react-router-dom';

type Props = {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const NominaHubLayout: React.FC<Props> = ({ title, subtitle, icon, iconColor = 'primary', actions, children }) => {
  const navigate = useNavigate();
  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <Button color="light" onClick={() => navigate('/nomina-hub')} title="Volver al hub">
            <i className="ri-arrow-left-line" /> Volver
          </Button>
          <div className="d-flex align-items-center gap-2">
            {icon && (
              <div className={`avatar-sm rounded-circle bg-${iconColor}-subtle d-flex align-items-center justify-content-center`} style={{ width: 40, height: 40 }}>
                <i className={`${icon} fs-20 text-${iconColor}`} />
              </div>
            )}
            <div>
              <h5 className="mb-0">{title}</h5>
              {subtitle && <div className="text-muted fs-13">{subtitle}</div>}
            </div>
          </div>
        </div>
        {actions && <div>{actions}</div>}
      </div>
      {children}
    </Container>
  );
};

export default NominaHubLayout;
