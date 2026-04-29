import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, CardBody, Col, Input, Row, Spinner, Table } from 'reactstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE, ThirdParty, kindColor, kindLabel, useAuthHeaders } from '../shared';
import BulkUploadThirdPartiesModal from '../../../Components/Common/BulkUploadThirdPartiesModal';

const PAGE_SIZE = 50;

const ListaTerceros: React.FC = () => {
  const navigate = useNavigate();
  const headers = useAuthHeaders();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [items, setItems] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkOpen, setBulkOpen] = useState(false);
  const tab = searchParams.get('tab');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search) qs.set('search', search);
      if (kind) qs.set('kind', kind);
      const res = await fetch(`${API_BASE}/accounting/third-parties?${qs.toString()}`, { headers });
      const data = await res.json();
      if (data.success) setItems(data.thirdParties || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [headers, search, kind]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => { setPage(1); load(); };

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  return (
    <>
      <Card className="shadow-sm mb-3" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <CardBody>
          {tab === 'movimientos' && (
            <div className="mb-2">
              <Badge color="info" className="p-2">
                <i className="ri-exchange-line me-1" /> Selecciona un tercero para ver sus movimientos
              </Badge>
            </div>
          )}
          <Row className="g-2 align-items-end">
            <Col md={5}>
              <label className="form-label fs-12 text-muted mb-1">Buscar</label>
              <Input
                placeholder="Nombre o documento"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') applyFilters(); }}
              />
            </Col>
            <Col md={3}>
              <label className="form-label fs-12 text-muted mb-1">Tipo</label>
              <Input type="select" value={kind} onChange={e => setKind(e.target.value)}>
                <option value="">Todos</option>
                <option value="CUSTOMER">Clientes</option>
                <option value="SUPPLIER">Proveedores</option>
                <option value="EMPLOYEE">Empleados</option>
                <option value="OTHER">Otros</option>
              </Input>
            </Col>
            <Col md={2}>
              <Button color="primary" onClick={applyFilters} disabled={loading} className="w-100">
                <i className="ri-filter-line me-1" /> Aplicar
              </Button>
            </Col>
            <Col md={2}>
              <Button color="success" onClick={() => setBulkOpen(true)} className="w-100">
                <i className="ri-file-excel-2-line me-1" /> Carga masiva
              </Button>
            </Col>
          </Row>
        </CardBody>
      </Card>

      <Card className="shadow-sm">
        <CardBody>
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="ri-inbox-line fs-32 d-block mb-2" />
              No hay terceros que coincidan con los filtros.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Documento</th>
                      <th>Tipo</th>
                      <th>Email</th>
                      <th>Ciudad</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(t => (
                      <tr key={t.id}>
                        <td className="fw-semibold">{t.name}</td>
                        <td className="font-monospace fs-13">
                          {t.document_type ? <span className="text-muted me-1">{t.document_type}</span> : null}
                          {t.document_number}
                        </td>
                        <td><Badge color={kindColor(t.kind)}>{kindLabel(t.kind)}</Badge></td>
                        <td className="text-muted fs-13">{t.email || '-'}</td>
                        <td className="text-muted fs-13">{t.city || '-'}</td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            color="light"
                            title="Ver detalle"
                            onClick={() => navigate(`/terceros-hub/${t.id}`, { state: { thirdParty: t } })}
                          >
                            <i className="ri-eye-line" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="text-muted fs-13">
                    Página {page} de {totalPages} · {items.length} terceros
                  </div>
                  <div className="d-flex gap-2">
                    <Button size="sm" color="light" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <i className="ri-arrow-left-s-line" /> Anterior
                    </Button>
                    <Button size="sm" color="light" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      Siguiente <i className="ri-arrow-right-s-line" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <BulkUploadThirdPartiesModal
        isOpen={bulkOpen}
        toggle={() => setBulkOpen((v) => !v)}
        onComplete={() => load()}
      />
    </>
  );
};

export default ListaTerceros;
