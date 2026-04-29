// ClientesList.tsx
// Componente para listar clientes/empresas creadas en facturas
// Estilo completo inspirado en Velzon CRM Contacts

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  Col, 
  Row, 
  Button, 
  Spinner, 
  Badge,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Table
} from 'reactstrap';
import { Link } from 'react-router-dom';
import TableContainer from '../../../../Components/Common/TableContainerReactTable';
import { api } from '../../../../services/api';
import { jwtDecode } from 'jwt-decode';
import { getToken } from '../../../../services/auth';

interface Client {
  id: string;
  name: string;
  identification_type?: string;
  identification_number?: string;
  dv?: string;
  email?: string;
  phone?: string;
  address?: string;
  city_code?: string;
  tax_responsibility?: string;
  created_at?: string;
  invoices_count?: number;
}

const ClientesList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const decodeTenantId = (): string | null => {
    try {
      const t = getToken();
      if (!t) return null;
      const decoded: any = jwtDecode(t);
      return decoded?.user?.tenant_id || decoded?.tenant_id || null;
    } catch {
      return null;
    }
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = decodeTenantId();
      if (!tenantId) {
        setError('No se encontró el tenant en tu sesión.');
        return;
      }

      // Obtener clientes desde el endpoint real del backend
      try {
        const response = await api.get(`/users/tenant/${tenantId}/clients`);
        const clientRows = Array.isArray(response.data) ? response.data : [];
        if (clientRows.length > 0) {
          const normalizedClients = clientRows.map((client: any) => ({
            id: client.id,
            name: client.name || `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Sin nombre',
            identification_type: client.identification_type || 'CC',
            identification_number: client.identification_number || '',
            dv: client.dv || '',
            email: client.email || '',
            phone: client.phone || '',
            address: client.address || '',
            city_code: client.city_code || '',
            tax_responsibility: client.tax_responsibility || '',
            created_at: client.created_at,
            invoices_count: client.cantidadServicios || client.invoices_count || 0,
          }));
          setClients(normalizedClients);
          setSelectedClient((prev) => (prev ? prev : normalizedClients[0] ?? null));
          return;
        }
      } catch (e: any) {
        // Si no existe el endpoint, intentar obtener de invoices como fallback
        console.log('Endpoint /clients no disponible, obteniendo de invoices...');
        
        // Fallback: obtener clientes únicos de las facturas
        const invoicesResponse = await api.get(`/invoices`);
        const invoiceRows = Array.isArray(invoicesResponse.data?.invoices)
          ? invoicesResponse.data.invoices
          : Array.isArray(invoicesResponse.data)
            ? invoicesResponse.data
            : [];

        if (invoiceRows.length > 0) {
          const tenantInvoices = invoiceRows.filter((inv: any) => String(inv.tenant_id || tenantId) === String(tenantId));
          const uniqueClients = new Map<string, Client>();
          
          tenantInvoices.forEach((invoice: any) => {
            const documentNumber = invoice.client_document_number || invoice.client_nit || invoice.client_id || '';
            if (documentNumber || invoice.client_name) {
              const clientKey = documentNumber || invoice.client_name;
              if (!uniqueClients.has(clientKey)) {
                uniqueClients.set(clientKey, {
                  id: invoice.client_id || clientKey,
                  name: invoice.client_name || 'Sin nombre',
                  identification_type: invoice.client_document_type || invoice.client_doc_type || 'NIT',
                  identification_number: documentNumber,
                  dv: '',
                  email: invoice.client_email || '',
                  phone: '',
                  address: '',
                  tax_responsibility: '',
                  created_at: invoice.created_at,
                  invoices_count: 1
                });
              } else {
                const existing = uniqueClients.get(clientKey)!;
                existing.invoices_count = (existing.invoices_count || 0) + 1;
              }
            }
          });

          const clientsArray = Array.from(uniqueClients.values());
          setClients(clientsArray);
          setSelectedClient((prev) => (prev ? prev : clientsArray[0] ?? null));
          return;
        }
      }
    } catch (e: any) {
      console.error('Error cargando clientes:', e);
      setError(e?.response?.data?.message || e?.message || 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Función para obtener inicial del nombre
  const getInitial = (name: string) => {
    return name?.charAt(0)?.toUpperCase() || 'C';
  };

  // Función para obtener color del badge según tipo
  const getTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'CC': 'info',
      'NIT': 'primary',
      'CE': 'warning',
      'TI': 'success'
    };
    return colorMap[type || 'NIT'] || 'secondary';
  };

  // Función para obtener color soft del badge según tipo
  const getTypeSoftColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'CC': 'soft-info',
      'NIT': 'soft-primary',
      'CE': 'soft-warning',
      'TI': 'soft-success'
    };
    return colorMap[type || 'NIT'] || 'soft-secondary';
  };

  const columns = useMemo(
    () => [
      {
        header: "Nombre / Razón Social",
        accessorKey: "name",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const client = cell.row.original;
          return (
            <div className="d-flex align-items-center">
              <div className="flex-shrink-0">
                <div className="avatar-xs">
                  <div className={`avatar-title rounded-circle bg-${getTypeSoftColor(client.identification_type)} text-${getTypeColor(client.identification_type)}`}>
                    {getInitial(client.name)}
                  </div>
                </div>
              </div>
              <div className="flex-grow-1 ms-2 name">
                <span 
                  className="fw-semibold text-primary cursor-pointer"
                  onClick={() => setSelectedClient(client)}
                  style={{ cursor: 'pointer' }}
                >
                  {cell.getValue() || 'Sin nombre'}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        header: "Tipo",
        accessorKey: "identification_type",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const type = cell.getValue() || 'NIT';
          return (
            <Badge color={getTypeSoftColor(type)} className="text-uppercase">
              {type}
            </Badge>
          );
        },
      },
      {
        header: "Identificación",
        accessorKey: "identification_number",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const row = cell.row.original;
          const number = row.identification_number || '';
          const dv = row.dv ? `-${row.dv}` : '';
          return <span className="font-monospace">{number}{dv}</span>;
        },
      },
      {
        header: "Email",
        accessorKey: "email",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const email = cell.getValue();
          return email ? (
            <a href={`mailto:${email}`} className="text-reset">
              {email}
            </a>
          ) : (
            <span className="text-muted">—</span>
          );
        },
      },
      {
        header: "Teléfono",
        accessorKey: "phone",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const phone = cell.getValue();
          return phone ? (
            <a href={`tel:${phone}`} className="text-reset">
              {phone}
            </a>
          ) : (
            <span className="text-muted">—</span>
          );
        },
      },
      {
        header: "Dirección",
        accessorKey: "address",
        enableColumnFilter: true,
        cell: (cell: any) => {
          const address = cell.getValue();
          return address ? (
            <span className="text-truncate d-block" style={{ maxWidth: '200px' }} title={address}>
              {address}
            </span>
          ) : (
            <span className="text-muted">—</span>
          );
        },
      },
      {
        header: "Facturas",
        accessorKey: "invoices_count",
        enableColumnFilter: false,
        cell: (cell: any) => {
          const count = cell.getValue() || 0;
          return (
            <Badge color="soft-success" className="badge-label">
              <i className="mdi mdi-file-document-outline label-icon"></i>
              {count}
            </Badge>
          );
        },
      },
      {
        header: "Acción",
        cell: (cellProps: any) => {
          const client = cellProps.row.original;
          return (
            <ul className="list-inline hstack gap-2 mb-0">
              <li className="list-inline-item" title="Ver detalles">
                <Link 
                  to="#" 
                  className="text-muted d-inline-block"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedClient(client);
                  }}
                >
                  <i className="ri-eye-line fs-16"></i>
                </Link>
              </li>
              <li className="list-inline-item" title="Llamar">
                {client.phone && (
                  <Link to={`tel:${client.phone}`} className="text-muted d-inline-block">
                    <i className="ri-phone-line fs-16"></i>
                  </Link>
                )}
              </li>
              <li className="list-inline-item" title="Enviar email">
                {client.email && (
                  <Link to={`mailto:${client.email}`} className="text-muted d-inline-block">
                    <i className="ri-mail-line fs-16"></i>
                  </Link>
                )}
              </li>
              <li className="list-inline-item">
                <UncontrolledDropdown>
                  <DropdownToggle
                    href="#"
                    className="btn btn-soft-primary btn-sm dropdown"
                    tag="button"
                  >
                    <i className="ri-more-fill align-middle"></i>
                  </DropdownToggle>
                  <DropdownMenu className="dropdown-menu-end">
                    <DropdownItem 
                      className="dropdown-item" 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setSelectedClient(client);
                      }}
                    >
                      <i className="ri-eye-fill align-bottom me-2 text-muted"></i>
                      Ver Detalles
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              </li>
            </ul>
          );
        },
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner color="primary" className="mb-3" />
        <p className="text-muted">Cargando clientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-center" role="alert">
        <i className="ri-error-warning-line me-2 fs-16"></i>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <Row>
      {/* Columna principal - Tabla de clientes */}
      <Col xxl={9}>
        <Card id="clientList">
          <CardHeader>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <div className="flex-grow-1">
                <h5 className="mb-0 fs-20">Clientes / Empresas</h5>
                <p className="text-muted mb-0 fs-15">
                  Listado de empresas y clientes que se han creado al generar facturas.
                </p>
              </div>
              <div className="flex-shrink-0">
                <div className="hstack text-nowrap gap-2">
                  <Button color="primary" onClick={loadClients} className="btn-label">
                    <i className="ri-refresh-line label-icon align-middle fs-16 me-2"></i>
                    Actualizar
                  </Button>
                  <UncontrolledDropdown>
                    <DropdownToggle
                      href="#"
                      className="btn btn-soft-info"
                      tag="button"
                    >
                      <i className="ri-more-2-fill"></i>
                    </DropdownToggle>
                    <DropdownMenu className="dropdown-menu-end">
                      <DropdownItem className="dropdown-item" href="#">Todos</DropdownItem>
                      <DropdownItem className="dropdown-item" href="#">Esta semana</DropdownItem>
                      <DropdownItem className="dropdown-item" href="#">Este mes</DropdownItem>
                      <DropdownItem className="dropdown-item" href="#">Este año</DropdownItem>
                    </DropdownMenu>
                  </UncontrolledDropdown>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-0" style={{ fontSize: '16px' }}>
            {clients.length === 0 ? (
              <div className="text-center py-5">
                <div className="avatar-md mx-auto mb-4">
                  <div className="avatar-title bg-soft-primary text-primary rounded-circle fs-24">
                    <i className="ri-user-line"></i>
                  </div>
                </div>
                <h5>No hay clientes registrados</h5>
                <p className="text-muted">
                  Los clientes se crearán automáticamente cuando generes facturas.
                </p>
              </div>
            ) : (
              <TableContainer
                columns={columns}
                data={clients}
                customPageSize={8}
                SearchPlaceholder="Buscar clientes..."
                isGlobalFilter={true}
                divClass="table-responsive table-card mb-3"
                tableClass="align-middle table-nowrap fs-16"
                theadClass="table-light fs-15"
              />
            )}
          </CardBody>
        </Card>
      </Col>

      {/* Columna lateral - Detalles del cliente seleccionado */}
      <Col xxl={3}>
        <Card id="client-view-detail">
          <CardBody className="text-center">
            <div className="position-relative d-inline-block">
              <div className="avatar-lg rounded-circle img-thumbnail">
                <div className={`avatar-title bg-${getTypeSoftColor(selectedClient?.identification_type || 'NIT')} text-${getTypeColor(selectedClient?.identification_type || 'NIT')} rounded-circle`} style={{ width: '100%', height: '100%', fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selectedClient ? getInitial(selectedClient.name) : 'C'}
                </div>
              </div>
              <span className="contact-active position-absolute rounded-circle bg-success">
                <span className="visually-hidden"></span>
              </span>
            </div>
            <h5 className="mt-4 mb-1 fs-20">{selectedClient?.name || 'Selecciona un cliente'}</h5>
            <p className="text-muted fs-15">
              {selectedClient?.identification_type || 'NIT'} {selectedClient?.identification_number || ''}
              {selectedClient?.dv ? `-${selectedClient.dv}` : ''}
            </p>

            {selectedClient && (
              <ul className="list-inline mb-0">
                {selectedClient.phone && (
                  <li className="list-inline-item avatar-xs">
                    <Link
                      to={`tel:${selectedClient.phone}`}
                      className="avatar-title bg-success-subtle text-success fs-15 rounded"
                    >
                      <i className="ri-phone-line"></i>
                    </Link>
                  </li>
                )}
                {selectedClient.email && (
                  <li className="list-inline-item avatar-xs">
                    <Link
                      to={`mailto:${selectedClient.email}`}
                      className="avatar-title bg-danger-subtle text-danger fs-15 rounded"
                    >
                      <i className="ri-mail-line"></i>
                    </Link>
                  </li>
                )}
                <li className="list-inline-item avatar-xs">
                  <Link
                    to="#"
                    className="avatar-title bg-warning-subtle text-warning fs-15 rounded"
                    onClick={(e) => {
                      e.preventDefault();
                      // Aquí puedes agregar funcionalidad de chat/mensaje
                    }}
                  >
                    <i className="ri-question-answer-line"></i>
                  </Link>
                </li>
              </ul>
            )}
          </CardBody>
          {selectedClient && (
            <CardBody>
              <h6 className="text-muted text-uppercase fw-semibold mb-3 fs-17">
                Información del Cliente
              </h6>
              <div className="table-responsive table-card">
                <Table className="table table-borderless mb-0 fs-16">
                  <tbody>
                    <tr>
                      <td className="fw-medium">Tipo de Identificación</td>
                      <td>
                        <Badge color={getTypeSoftColor(selectedClient.identification_type || 'NIT')} className="text-uppercase">
                          {selectedClient.identification_type || 'NIT'}
                        </Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="fw-medium">Número de Identificación</td>
                      <td className="font-monospace">
                        {selectedClient.identification_number || '—'}
                        {selectedClient.dv ? `-${selectedClient.dv}` : ''}
                      </td>
                    </tr>
                    {selectedClient.email && (
                      <tr>
                        <td className="fw-medium">Email</td>
                        <td>
                          <a href={`mailto:${selectedClient.email}`} className="text-reset">
                            {selectedClient.email}
                          </a>
                        </td>
                      </tr>
                    )}
                    {selectedClient.phone && (
                      <tr>
                        <td className="fw-medium">Teléfono</td>
                        <td>
                          <a href={`tel:${selectedClient.phone}`} className="text-reset">
                            {selectedClient.phone}
                          </a>
                        </td>
                      </tr>
                    )}
                    {selectedClient.address && (
                      <tr>
                        <td className="fw-medium">Dirección</td>
                        <td>{selectedClient.address}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="fw-medium">Total Facturas</td>
                      <td>
                        <Badge color="soft-success">
                          {selectedClient.invoices_count || 0}
                        </Badge>
                      </td>
                    </tr>
                    {selectedClient.created_at && (
                      <tr>
                        <td className="fw-medium">Fecha de Registro</td>
                        <td>
                          {new Date(selectedClient.created_at).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </CardBody>
          )}
          {!selectedClient && (
            <CardBody>
              <div className="text-center py-4">
                <i className="ri-user-line fs-48 text-muted"></i>
                <p className="text-muted mt-3">Selecciona un cliente para ver sus detalles</p>
              </div>
            </CardBody>
          )}
        </Card>
      </Col>
    </Row>
  );
};

export default ClientesList;
