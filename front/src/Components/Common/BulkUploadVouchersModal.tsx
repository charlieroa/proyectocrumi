// Modal de carga masiva de Comprobantes Contables (journal vouchers).
// Acepta .xlsx, .xls y .csv. Usa POST /accounting/manual-vouchers/bulk.
//
// Formato: una fila por cada línea (débito o crédito). Se agrupan por
// `comprobante_ref`; todas las filas con el mismo ref se convierten en un
// solo comprobante con la fecha y descripción de la primera fila.
//
// Columnas esperadas:
//   comprobante_ref | fecha | descripcion | tipo_comp | cuenta |
//   tercero_nit | tercero_nombre | descripcion_linea | debito | credito

import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  Table,
} from 'reactstrap';
import Dropzone from 'react-dropzone';
import { API_BASE, useAuthHeaders } from '../../pages/Contabilidad/shared';
import { parseBulkUploadFile, downloadExcelTemplate } from './parseBulkUploadFile';

interface Props {
  isOpen: boolean;
  toggle: () => void;
  onComplete?: () => void;
}

interface ParsedRow {
  comprobante_ref: string;
  fecha: string;
  descripcion: string;
  tipo_comp: string;
  cuenta: string;
  tercero_nit: string;
  tercero_nombre: string;
  descripcion_linea: string;
  debito: string;
  credito: string;
}

interface ResultDetail {
  ref: string;
  status: 'created' | 'error';
  voucher_number?: string;
  journal_entry_id?: number;
  lines?: number;
  message?: string;
}

interface ResultSummary {
  success: boolean;
  totalGroups: number;
  created: number;
  errors: number;
  details: ResultDetail[];
}

const HEADERS = [
  'comprobante_ref',
  'fecha',
  'descripcion',
  'tipo_comp',
  'cuenta',
  'tercero_nit',
  'tercero_nombre',
  'descripcion_linea',
  'debito',
  'credito',
];

const EXAMPLE_ROWS: string[][] = [
  ['CG-001', '2026-04-15', 'Pago arriendo abril', 'CG', '511535', '', '', 'Arriendo oficina', '500000', '0'],
  ['CG-001', '2026-04-15', 'Pago arriendo abril', 'CG', '111005', '', '', 'Salida banco', '0', '500000'],
  ['CG-002', '2026-04-16', 'Compra insumos', 'CG', '143510', '900123456', 'Proveedor SAS', 'Inventario', '250000', '0'],
  ['CG-002', '2026-04-16', 'Compra insumos', 'CG', '220505', '900123456', 'Proveedor SAS', 'CxP proveedor', '0', '250000'],
];

const num = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;

const BulkUploadVouchersModal: React.FC<Props> = ({ isOpen, toggle, onComplete }) => {
  const headers = useAuthHeaders();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultSummary | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setRows([]);
    setParseError(null);
    setUploading(false);
    setResults(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    toggle();
  }, [reset, toggle]);

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setParseError(null);
    try {
      const raw = await parseBulkUploadFile(file);
      const parsed: ParsedRow[] = raw.map((r) => ({
        comprobante_ref: String(r.comprobante_ref || r.ref || '').trim(),
        fecha: String(r.fecha || r.date || '').trim(),
        descripcion: String(r.descripcion || r.description || '').trim(),
        tipo_comp: String(r.tipo_comp || r.voucher_type || '').trim(),
        cuenta: String(r.cuenta || r.account_code || r.codigo || '').trim(),
        tercero_nit: String(r.tercero_nit || r.third_party_document || r.nit || '').trim(),
        tercero_nombre: String(r.tercero_nombre || r.third_party_name || '').trim(),
        descripcion_linea: String(r.descripcion_linea || r.line_description || '').trim(),
        debito: String(r.debito || r.debit || '0').trim(),
        credito: String(r.credito || r.credit || '0').trim(),
      }));
      if (parsed.length === 0) {
        setParseError('El archivo no contiene filas de datos.');
        return;
      }
      setRows(parsed);
      setStep(2);
    } catch (err) {
      setParseError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Agrupar por comprobante_ref para validar balance débito=crédito
  const groups = useMemo(() => {
    const m = new Map<string, { rows: ParsedRow[]; indices: number[]; debit: number; credit: number }>();
    rows.forEach((r, i) => {
      const key = r.comprobante_ref || '__SIN_REF__';
      if (!m.has(key)) m.set(key, { rows: [], indices: [], debit: 0, credit: 0 });
      const g = m.get(key)!;
      g.rows.push(r);
      g.indices.push(i);
      g.debit += num(r.debito);
      g.credit += num(r.credito);
    });
    return m;
  }, [rows]);

  const groupSummary = useMemo(() => {
    return Array.from(groups.entries()).map(([ref, g]) => ({
      ref,
      lines: g.rows.length,
      debit: g.debit,
      credit: g.credit,
      balanced: Math.abs(g.debit - g.credit) < 0.01 && g.debit > 0,
      missingRef: ref === '__SIN_REF__',
    }));
  }, [groups]);

  const hasErrors = useMemo(() => groupSummary.some(g => !g.balanced || g.missingRef), [groupSummary]);

  const handleUpload = useCallback(async () => {
    setUploading(true);
    try {
      const res = await fetch(`${API_BASE}/accounting/manual-vouchers/bulk`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const data: ResultSummary = await res.json();
      if (!res.ok) {
        setResults({
          success: false,
          totalGroups: groupSummary.length,
          created: 0,
          errors: groupSummary.length,
          details: [{ ref: 'Error general', status: 'error', message: (data as any)?.error || `HTTP ${res.status}` }],
        });
      } else {
        setResults(data);
      }
      setStep(3);
    } catch (e) {
      setResults({
        success: false,
        totalGroups: groupSummary.length,
        created: 0,
        errors: groupSummary.length,
        details: [{ ref: 'Error general', status: 'error', message: e instanceof Error ? e.message : String(e) }],
      });
      setStep(3);
    } finally {
      setUploading(false);
    }
  }, [rows, headers, groupSummary.length]);

  const download = () => downloadExcelTemplate(HEADERS, EXAMPLE_ROWS, 'plantilla_comprobantes.xlsx');

  const money = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Modal isOpen={isOpen} toggle={handleClose} centered size="xl" scrollable>
      <ModalHeader toggle={handleClose} className="bg-primary-subtle">
        Carga Masiva de Comprobantes — {step === 1 ? 'Subir archivo' : step === 2 ? 'Previsualizar' : 'Resultados'}
      </ModalHeader>
      <ModalBody>
        {step === 1 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0 fs-13">
                Sube un archivo Excel (.xlsx) o CSV con las líneas de los comprobantes.
              </p>
              <Button color="light" size="sm" onClick={download}>
                <i className="ri-download-2-line me-1" /> Descargar plantilla
              </Button>
            </div>

            <Dropzone
              onDrop={handleDrop}
              accept={{
                'text/csv': ['.csv'],
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                'application/vnd.ms-excel': ['.xls'],
              }}
              maxFiles={1}
            >
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps()}
                  className={`border border-2 border-dashed rounded p-5 text-center ${
                    isDragActive ? 'bg-primary-subtle border-primary' : 'bg-light'
                  }`}
                  style={{ cursor: 'pointer' }}
                >
                  <input {...getInputProps()} />
                  <i className="ri-upload-cloud-2-line fs-32 text-primary d-block mb-2" />
                  <p className="mb-1 fw-medium">
                    {isDragActive ? 'Suelta el archivo aqui' : 'Arrastra tu archivo Excel o CSV'}
                  </p>
                  <p className="text-muted fs-12 mb-0">Formatos: .xlsx, .xls, .csv</p>
                </div>
              )}
            </Dropzone>

            {parseError && (
              <Alert color="danger" className="mt-3 mb-0">
                <i className="ri-error-warning-line me-2" />
                {parseError}
              </Alert>
            )}

            <Alert color="info" className="mt-3 mb-0">
              <p className="fw-semibold mb-1 fs-13">Formato: una fila por cada línea (débito o crédito).</p>
              <code className="fs-12 d-block">{HEADERS.join(', ')}</code>
              <p className="text-muted fs-12 mt-2 mb-0">
                Las filas con el mismo <strong>comprobante_ref</strong> se agrupan en un solo comprobante.
                La fecha y descripción se toman de la primera fila del grupo.
                Cada comprobante debe cuadrar: <strong>suma(débito) = suma(crédito)</strong>.
                Las cuentas deben existir previamente en el PUC.
              </p>
            </Alert>
          </>
        )}

        {step === 2 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted fs-13">
                {rows.length} línea{rows.length !== 1 ? 's' : ''} · {groups.size} comprobante{groups.size !== 1 ? 's' : ''}
              </span>
              <Button size="sm" color="link" onClick={() => { setRows([]); setStep(1); }}>
                Cambiar archivo
              </Button>
            </div>

            {/* Resumen por comprobante */}
            <div className="mb-3">
              <h6 className="fs-13 mb-2">Resumen por comprobante</h6>
              <div className="table-responsive">
                <Table size="sm" className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Ref</th>
                      <th className="text-end">Líneas</th>
                      <th className="text-end">Débito</th>
                      <th className="text-end">Crédito</th>
                      <th className="text-end">Diferencia</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSummary.map(g => {
                      const diff = g.debit - g.credit;
                      const okClass = g.balanced && !g.missingRef ? '' : 'table-danger';
                      return (
                        <tr key={g.ref} className={okClass}>
                          <td className="font-monospace">
                            {g.missingRef ? <span className="text-danger">(sin ref)</span> : g.ref}
                          </td>
                          <td className="text-end">{g.lines}</td>
                          <td className="text-end font-monospace">{money(g.debit)}</td>
                          <td className="text-end font-monospace">{money(g.credit)}</td>
                          <td className="text-end font-monospace">{money(diff)}</td>
                          <td>
                            {g.missingRef ? (
                              <Badge color="danger">falta ref</Badge>
                            ) : g.balanced ? (
                              <Badge color="success">cuadra</Badge>
                            ) : (
                              <Badge color="danger">descuadrado</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>

            {/* Detalle de líneas */}
            <h6 className="fs-13 mb-2">Líneas</h6>
            <div className="table-responsive" style={{ maxHeight: 300 }}>
              <Table size="sm" hover className="mb-0 align-middle">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Ref</th>
                    <th>Fecha</th>
                    <th>Cuenta</th>
                    <th>Tercero</th>
                    <th className="text-end">Débito</th>
                    <th className="text-end">Crédito</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="font-monospace fs-12">{r.comprobante_ref || <span className="text-danger">—</span>}</td>
                      <td className="fs-12">{r.fecha}</td>
                      <td className="font-monospace fs-12">{r.cuenta || <span className="text-danger">—</span>}</td>
                      <td className="text-muted fs-12">{r.tercero_nit || r.tercero_nombre || '-'}</td>
                      <td className="text-end font-monospace fs-12">{num(r.debito) > 0 ? money(num(r.debito)) : '-'}</td>
                      <td className="text-end font-monospace fs-12">{num(r.credito) > 0 ? money(num(r.credito)) : '-'}</td>
                      <td>
                        <Button size="sm" color="link" className="p-0 text-danger" onClick={() => removeRow(idx)}>
                          <i className="ri-delete-bin-line" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}

        {step === 3 && results && (
          <>
            <div className="d-flex gap-2 mb-3">
              <div className="flex-fill border border-success rounded p-3 text-center bg-success-subtle">
                <h3 className="mb-0 text-success">{results.created}</h3>
                <small className="text-success">Comprobantes creados</small>
              </div>
              {results.errors > 0 && (
                <div className="flex-fill border border-danger rounded p-3 text-center bg-danger-subtle">
                  <h3 className="mb-0 text-danger">{results.errors}</h3>
                  <small className="text-danger">Errores</small>
                </div>
              )}
            </div>
            <div className="table-responsive" style={{ maxHeight: 400 }}>
              <Table size="sm" className="mb-0 align-middle">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Ref</th>
                    <th>Número asignado</th>
                    <th>Líneas</th>
                    <th>Estado</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {results.details.map((d, idx) => (
                    <tr key={idx} className={d.status === 'error' ? 'table-danger' : ''}>
                      <td className="font-monospace fs-12">{d.ref}</td>
                      <td className="font-monospace fs-12">{d.voucher_number || '-'}</td>
                      <td>{d.lines ?? '-'}</td>
                      <td>
                        <Badge color={d.status === 'created' ? 'success' : 'danger'}>
                          {d.status === 'created' ? 'creado' : 'error'}
                        </Badge>
                      </td>
                      <td className="text-muted fs-12">{d.message || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {step === 2 && (
          <>
            <Button color="light" onClick={() => setStep(1)}>Atras</Button>
            <Button
              color="primary"
              onClick={handleUpload}
              disabled={uploading || rows.length === 0 || hasErrors}
            >
              {uploading ? (
                <><Spinner size="sm" className="me-2" /> Importando...</>
              ) : (
                <>Importar {groups.size} comprobante{groups.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          </>
        )}
        {step === 3 && (
          <Button color="primary" onClick={() => { onComplete?.(); handleClose(); }}>
            Cerrar
          </Button>
        )}
        {step === 1 && <Button color="light" onClick={handleClose}>Cancelar</Button>}
      </ModalFooter>
    </Modal>
  );
};

export default BulkUploadVouchersModal;
