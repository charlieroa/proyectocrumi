// Modal de carga masiva para terceros (CUSTOMER / SUPPLIER / EMPLOYEE / OTHER).
// Acepta archivos .xlsx, .xls y .csv. Usa el endpoint POST
// /accounting/third-parties/bulk.
//
// Columnas esperadas (header de la primera fila):
//   tipo_documento, numero_documento, nombre, tipo (CLIENTE|PROVEEDOR|EMPLEADO|OTRO),
//   email, telefono, direccion, ciudad, departamento

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
import { API_BASE, useAuthHeaders } from '../../pages/TercerosHub/shared';
import { parseBulkUploadFile, downloadExcelTemplate } from './parseBulkUploadFile';

interface Props {
  isOpen: boolean;
  toggle: () => void;
  onComplete?: () => void;
  /** Si se define, aplica ese kind a todas las filas e ignora la columna `tipo` del Excel. */
  defaultKind?: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'OTHER';
}

interface ParsedRow {
  tipo_documento: string;
  numero_documento: string;
  nombre: string;
  tipo: string;
  email: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento: string;
}

interface ResultDetail {
  rowIndex?: number;
  name: string;
  documentNumber?: string;
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

const HEADERS = [
  'tipo_documento',
  'numero_documento',
  'nombre',
  'tipo',
  'email',
  'telefono',
  'direccion',
  'ciudad',
  'departamento',
];

const EXAMPLE_ROWS: string[][] = [
  ['NIT', '900123456', 'Cliente Demo SAS', 'CLIENTE', 'cliente@demo.com', '3001234567', 'Calle 1 #2-3', 'Bogota', 'Cundinamarca'],
  ['NIT', '800987654', 'Proveedor Demo LTDA', 'PROVEEDOR', 'proveedor@demo.com', '3109876543', 'Carrera 5 #10-20', 'Medellin', 'Antioquia'],
  ['CC', '1020304050', 'Juan Perez', 'EMPLEADO', 'juan@empresa.com', '3001111111', '', 'Bogota', 'Cundinamarca'],
];

// Map "CLIENTE/PROVEEDOR/EMPLEADO/OTRO" (ES) → kind esperado por el back (EN).
const mapKind = (raw: string): string => {
  const k = (raw || '').trim().toUpperCase();
  if (k.startsWith('CLI') || k === 'CUSTOMER') return 'CUSTOMER';
  if (k.startsWith('PROV') || k === 'SUPPLIER') return 'SUPPLIER';
  if (k.startsWith('EMPL') || k === 'EMPLOYEE') return 'EMPLOYEE';
  return 'OTHER';
};

const BulkUploadThirdPartiesModal: React.FC<Props> = ({ isOpen, toggle, onComplete, defaultKind }) => {
  const headers = useAuthHeaders();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<ResultSummary | null>(null);
  // Permite elegir un kind global para TODAS las filas (ignora columna `tipo`).
  // Default 'MIXED' = usa la columna tipo del archivo (comportamiento anterior).
  const [selectedKind, setSelectedKind] = useState<'MIXED' | 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'OTHER'>(defaultKind || 'MIXED');

  // Si el parent cambia defaultKind, reflejamos.
  React.useEffect(() => { if (defaultKind) setSelectedKind(defaultKind); }, [defaultKind]);

  const kindLabelMap: Record<typeof selectedKind, string> = {
    MIXED: 'Según columna del Excel',
    CUSTOMER: 'Clientes',
    SUPPLIER: 'Proveedores',
    EMPLOYEE: 'Empleados',
    OTHER: 'Otros',
  };

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
        tipo_documento: (r.tipo_documento || '').trim(),
        numero_documento: (r.numero_documento || '').trim(),
        nombre: (r.nombre || '').trim(),
        tipo: (r.tipo || '').trim(),
        email: (r.email || '').trim(),
        telefono: (r.telefono || '').trim(),
        direccion: (r.direccion || '').trim(),
        ciudad: (r.ciudad || '').trim(),
        departamento: (r.departamento || '').trim(),
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
      if (!r.nombre) errs.push('falta nombre');
      if (!r.numero_documento) errs.push('falta documento');
      return errs;
    });
  }, [rows]);

  const hasErrors = useMemo(() => validation.some((v) => v.length > 0), [validation]);

  const handleUpload = useCallback(async () => {
    setUploading(true);
    try {
      const payload = rows.map((r) => ({
        documentType: r.tipo_documento || null,
        documentNumber: r.numero_documento,
        name: r.nombre,
        // Si el usuario eligió un tipo específico, se aplica a todas las filas.
        // Si eligió 'MIXED', usamos la columna `tipo` del Excel.
        kind: selectedKind === 'MIXED' ? mapKind(r.tipo) : selectedKind,
        email: r.email || null,
        phone: r.telefono || null,
        address: r.direccion || null,
        city: r.ciudad || null,
        department: r.departamento || null,
      }));
      const res = await fetch(`${API_BASE}/accounting/third-parties/bulk`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ thirdParties: payload }),
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

  const download = () => downloadExcelTemplate(HEADERS, EXAMPLE_ROWS, 'plantilla_terceros.xlsx');

  return (
    <Modal isOpen={isOpen} toggle={handleClose} centered size="xl" scrollable>
      <ModalHeader toggle={handleClose} className="bg-primary-subtle">
        Carga Masiva de Terceros — {step === 1 ? 'Subir archivo' : step === 2 ? 'Previsualizar' : 'Resultados'}
      </ModalHeader>
      <ModalBody>
        {step === 1 && (
          <>
            <Alert color="light" className="border mb-3">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <strong className="fs-13">Tipo de terceros a importar:</strong>
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 260 }}
                  value={selectedKind}
                  onChange={(e) => setSelectedKind(e.target.value as any)}
                >
                  <option value="MIXED">Mixto (usa columna "tipo" del Excel)</option>
                  <option value="CUSTOMER">Solo Clientes</option>
                  <option value="SUPPLIER">Solo Proveedores</option>
                  <option value="EMPLOYEE">Solo Empleados</option>
                  <option value="OTHER">Solo Otros</option>
                </select>
                {selectedKind !== 'MIXED' && (
                  <Badge color="info" className="fs-11">
                    Se ignorará la columna "tipo" · todos serán {kindLabelMap[selectedKind]}
                  </Badge>
                )}
              </div>
            </Alert>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0 fs-13">
                Sube un archivo Excel (.xlsx) o CSV con los terceros a importar.
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
              <p className="fw-semibold mb-1 fs-13">Columnas esperadas (nombres del header):</p>
              <code className="fs-12 d-block">{HEADERS.join(', ')}</code>
              <p className="text-muted fs-12 mt-2 mb-0">
                <strong>tipo</strong>: CLIENTE, PROVEEDOR, EMPLEADO u OTRO. Solo{' '}
                <strong>nombre</strong> y <strong>numero_documento</strong> son obligatorios.
              </p>
            </Alert>
          </>
        )}

        {step === 2 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted fs-13">
                {rows.length} tercero{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
              </span>
              <Button size="sm" color="link" onClick={() => { setRows([]); setStep(1); }}>
                Cambiar archivo
              </Button>
            </div>
            <div className="table-responsive">
              <Table size="sm" hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Email</th>
                    <th>Ciudad</th>
                    <th>Estado</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const errs = validation[idx];
                    return (
                      <tr key={idx} className={errs.length > 0 ? 'table-danger' : ''}>
                        <td>{r.nombre || <span className="text-danger fst-italic">vacio</span>}</td>
                        <td className="font-monospace fs-12">
                          {r.tipo_documento && <span className="text-muted me-1">{r.tipo_documento}</span>}
                          {r.numero_documento || <span className="text-danger fst-italic">vacio</span>}
                        </td>
                        <td><Badge color="light" className="text-dark">{mapKind(r.tipo)}</Badge></td>
                        <td className="text-muted fs-12">{r.email || '-'}</td>
                        <td className="text-muted fs-12">{r.ciudad || '-'}</td>
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
                <small className="text-success">Creados</small>
              </div>
              <div className="flex-fill border border-info rounded p-3 text-center bg-info-subtle">
                <h3 className="mb-0 text-info">{results.updated}</h3>
                <small className="text-info">Actualizados</small>
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
                    <th>Documento</th>
                    <th>Estado</th>
                    <th>Mensaje</th>
                  </tr>
                </thead>
                <tbody>
                  {results.details.map((d, idx) => (
                    <tr key={idx} className={d.status === 'error' ? 'table-danger' : ''}>
                      <td className="text-muted fs-12">{(d.rowIndex ?? idx) + 1}</td>
                      <td>{d.name}</td>
                      <td className="font-monospace fs-12">{d.documentNumber || '-'}</td>
                      <td>
                        <Badge color={
                          d.status === 'created' ? 'success' :
                          d.status === 'updated' ? 'info' : 'danger'
                        }>
                          {d.status === 'created' ? 'creado' : d.status === 'updated' ? 'actualizado' : 'error'}
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
                <>Importar {rows.length} tercero{rows.length !== 1 ? 's' : ''}</>
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

export default BulkUploadThirdPartiesModal;
