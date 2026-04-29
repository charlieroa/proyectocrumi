// Modal de carga masiva para el Plan de Cuentas (PUC).
// Acepta .xlsx, .xls y .csv. Usa POST /accounting/chart-of-accounts/bulk.
//
// Columnas esperadas (header de la primera fila):
//   codigo, nombre, tipo, cuenta_padre, activa
//
// - tipo: ACTIVO | PASIVO | PATRIMONIO | INGRESO | GASTO | COSTO | CUENTAS_ORDEN (opcional)
// - cuenta_padre: si se deja vacío, se deriva automáticamente del código.
// - activa: SI/NO (default SI)

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
  codigo: string;
  nombre: string;
  tipo: string;
  cuenta_padre: string;
  activa: string;
}

interface ResultDetail {
  rowIndex?: number;
  name: string;
  account_code?: string;
  status: 'created' | 'updated' | 'error';
  id?: number;
  message?: string;
}

interface ResultSummary {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  errors: number;
  details: ResultDetail[];
}

const HEADERS = ['codigo', 'nombre', 'tipo', 'cuenta_padre', 'activa'];

const EXAMPLE_ROWS: string[][] = [
  ['1', 'ACTIVO', 'ACTIVO', '', 'SI'],
  ['11', 'DISPONIBLE', 'ACTIVO', '1', 'SI'],
  ['1105', 'CAJA', 'ACTIVO', '11', 'SI'],
  ['110505', 'Caja general', 'ACTIVO', '1105', 'SI'],
  ['11050501', 'Caja menor oficina', 'ACTIVO', '110505', 'SI'],
];

const VALID_TYPES = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO', 'CUENTAS_ORDEN'];

const normalizeType = (raw: string): string => {
  const t = (raw || '').trim().toUpperCase();
  if (!t) return '';
  if (VALID_TYPES.includes(t)) return t;
  if (t.startsWith('ACT')) return 'ACTIVO';
  if (t.startsWith('PAS')) return 'PASIVO';
  if (t.startsWith('PAT')) return 'PATRIMONIO';
  if (t.startsWith('ING')) return 'INGRESO';
  if (t.startsWith('GAS')) return 'GASTO';
  if (t.startsWith('COS')) return 'COSTO';
  if (t.startsWith('ORD') || t.includes('ORDEN')) return 'CUENTAS_ORDEN';
  return '';
};

const BulkUploadAccountsModal: React.FC<Props> = ({ isOpen, toggle, onComplete }) => {
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
        codigo: String(r.codigo || r.code || r.account_code || '').trim(),
        nombre: String(r.nombre || r.name || r.account_name || '').trim(),
        tipo: String(r.tipo || r.type || r.account_type || '').trim(),
        cuenta_padre: String(r.cuenta_padre || r.parent || r.parent_code || '').trim(),
        activa: String(r.activa || r.active || r.is_active || '').trim(),
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

  const validation = useMemo(() => {
    return rows.map((r) => {
      const errs: string[] = [];
      if (!r.codigo) errs.push('falta codigo');
      else if (!/^[0-9]{1,10}$/.test(r.codigo)) errs.push('codigo invalido');
      if (!r.nombre) errs.push('falta nombre');
      if (r.tipo && !normalizeType(r.tipo)) errs.push('tipo invalido');
      return errs;
    });
  }, [rows]);

  const hasErrors = useMemo(() => validation.some((v) => v.length > 0), [validation]);

  const handleUpload = useCallback(async () => {
    setUploading(true);
    try {
      const payload = rows.map((r) => {
        const activa = r.activa.trim().toUpperCase();
        const isActive = activa === '' || activa === 'SI' || activa === 'SÍ' || activa === 'YES' || activa === 'TRUE' || activa === '1';
        return {
          accountCode: r.codigo,
          accountName: r.nombre,
          accountType: normalizeType(r.tipo) || null,
          parentCode: r.cuenta_padre || null,
          isActive,
        };
      });
      const res = await fetch(`${API_BASE}/accounting/chart-of-accounts/bulk`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: payload }),
      });
      const data: ResultSummary = await res.json();
      if (!res.ok) {
        setResults({
          success: false,
          total: rows.length,
          created: 0,
          updated: 0,
          errors: rows.length,
          details: [{ name: 'Error general', status: 'error', message: (data as any)?.error || `HTTP ${res.status}` }],
        });
      } else {
        setResults(data);
      }
      setStep(3);
    } catch (e) {
      setResults({
        success: false,
        total: rows.length,
        created: 0,
        updated: 0,
        errors: rows.length,
        details: [{ name: 'Error general', status: 'error', message: e instanceof Error ? e.message : String(e) }],
      });
      setStep(3);
    } finally {
      setUploading(false);
    }
  }, [rows, headers]);

  const download = () => downloadExcelTemplate(HEADERS, EXAMPLE_ROWS, 'plantilla_puc.xlsx');

  return (
    <Modal isOpen={isOpen} toggle={handleClose} centered size="xl" scrollable>
      <ModalHeader toggle={handleClose} className="bg-primary-subtle">
        Carga Masiva de Plan de Cuentas — {step === 1 ? 'Subir archivo' : step === 2 ? 'Previsualizar' : 'Resultados'}
      </ModalHeader>
      <ModalBody>
        {step === 1 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0 fs-13">
                Sube un archivo Excel (.xlsx) o CSV con las cuentas a importar.
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
              <p className="fw-semibold mb-1 fs-13">Columnas esperadas:</p>
              <code className="fs-12 d-block">{HEADERS.join(', ')}</code>
              <p className="text-muted fs-12 mt-2 mb-0">
                <strong>codigo</strong> (obligatorio, solo dígitos) y <strong>nombre</strong> (obligatorio).{' '}
                <strong>tipo</strong>: ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO, COSTO o CUENTAS_ORDEN.{' '}
                <strong>cuenta_padre</strong> se deriva del código si está vacío.{' '}
                <strong>activa</strong>: SI/NO (default SI). Jerarquía: 1-dig=Clase, 2-dig=Grupo, 4-dig=Cuenta, 6-dig=Subcuenta, 8-dig=Auxiliar.
              </p>
            </Alert>
          </>
        )}

        {step === 2 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted fs-13">
                {rows.length} cuenta{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}
              </span>
              <Button size="sm" color="link" onClick={() => { setRows([]); setStep(1); }}>
                Cambiar archivo
              </Button>
            </div>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Padre</th>
                    <th>Activa</th>
                    <th>Estado</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const errs = validation[idx];
                    const type = normalizeType(r.tipo);
                    return (
                      <tr key={idx} className={errs.length > 0 ? 'table-danger' : ''}>
                        <td className="font-monospace fs-12">
                          {r.codigo || <span className="text-danger fst-italic">vacio</span>}
                        </td>
                        <td>{r.nombre || <span className="text-danger fst-italic">vacio</span>}</td>
                        <td>{type ? <Badge color="light" className="text-dark">{type}</Badge> : <span className="text-muted">-</span>}</td>
                        <td className="font-monospace text-muted fs-12">{r.cuenta_padre || '(auto)'}</td>
                        <td className="fs-12">{r.activa || 'SI'}</td>
                        <td>
                          {errs.length > 0 ? (
                            <Badge color="danger" className="fs-11">{errs.join(', ')}</Badge>
                          ) : (
                            <Badge color="success" className="fs-11">OK</Badge>
                          )}
                        </td>
                        <td>
                          <Button size="sm" color="link" className="p-0 text-danger" onClick={() => removeRow(idx)}>
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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
                <small className="text-success">Creadas</small>
              </div>
              <div className="flex-fill border border-info rounded p-3 text-center bg-info-subtle">
                <h3 className="mb-0 text-info">{results.updated}</h3>
                <small className="text-info">Actualizadas</small>
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
                    <th style={{ width: 40 }}>#</th>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Estado</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {results.details.map((d, idx) => (
                    <tr key={idx} className={d.status === 'error' ? 'table-danger' : ''}>
                      <td className="text-muted fs-12">{(d.rowIndex ?? idx) + 1}</td>
                      <td>{d.name}</td>
                      <td className="font-monospace fs-12">{d.account_code || '-'}</td>
                      <td>
                        <Badge color={
                          d.status === 'created' ? 'success' :
                          d.status === 'updated' ? 'info' : 'danger'
                        }>
                          {d.status === 'created' ? 'creada' : d.status === 'updated' ? 'actualizada' : 'error'}
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
                <>Importar {rows.length} cuenta{rows.length !== 1 ? 's' : ''}</>
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

export default BulkUploadAccountsModal;
