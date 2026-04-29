import React, { useState, useCallback, useMemo } from 'react';
import Dropzone from 'react-dropzone';
import Swal from 'sweetalert2';
import CrumiModal from './CrumiModal';
import { api } from '../../services/api';
import { parseBulkUploadFile, downloadExcelTemplate } from './parseBulkUploadFile';

interface BulkUploadModalProps {
  isOpen: boolean;
  toggle: () => void;
  onComplete?: () => void;
}

interface ParsedRow {
  nombre: string;
  nit: string;
  email: string;
  telefono: string;
  direccion: string;
  departamento: string;
  municipio: string;
  responsabilidad_fiscal: string;
  facturacion_electronica: string;
  test_set_id: string;
}

interface ResultDetail {
  name: string;
  status: 'created' | 'error';
  email?: string;
  message?: string;
  tenant_id?: string;
  needs_electronic_invoice?: boolean;
}

const CSV_HEADERS = [
  'nombre', 'nit', 'email', 'telefono', 'direccion',
  'departamento', 'municipio', 'responsabilidad_fiscal',
  'facturacion_electronica', 'test_set_id',
];

const EXAMPLE_ROWS: string[][] = [
  ['Mi Empresa SAS', '900123456-7', 'admin@empresa.com', '3001234567', 'Calle 1 #2-3', 'Cundinamarca', 'Bogota', 'Responsable de IVA', 'no', ''],
  ['Otra Empresa', '800987654-3', 'info@otra.com', '3109876543', 'Carrera 5 #10-20', 'Antioquia', 'Medellin', 'Regimen Simple', 'si', 'SET-ABC123'],
];

const downloadTemplate = () => {
  downloadExcelTemplate(CSV_HEADERS, EXAMPLE_ROWS, 'plantilla_empresas.xlsx');
};

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, toggle, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: number; details: ResultDetail[] } | null>(null);

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
        nombre: (r.nombre || '').trim(),
        nit: (r.nit || '').trim(),
        email: (r.email || '').trim(),
        telefono: (r.telefono || '').trim(),
        direccion: (r.direccion || '').trim(),
        departamento: (r.departamento || '').trim(),
        municipio: (r.municipio || '').trim(),
        responsabilidad_fiscal: (r.responsabilidad_fiscal || '').trim(),
        facturacion_electronica: (r.facturacion_electronica || '').trim().toLowerCase(),
        test_set_id: (r.test_set_id || '').trim(),
      }));
      if (parsed.length === 0) {
        setParseError('El archivo no contiene filas de datos.');
        return;
      }
      setRows(parsed);
      setStep(2);
    } catch (err) {
      setParseError(`Error al procesar archivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const validation = useMemo(() => {
    return rows.map((r) => {
      const errors: string[] = [];
      if (!r.nombre) errors.push('Falta nombre');
      if (!r.nit) errors.push('Falta NIT');
      if (!r.email) errors.push('Falta email');
      if (r.facturacion_electronica === 'si' && !r.test_set_id) errors.push('Falta test_set_id para facturacion electronica');
      return errors;
    });
  }, [rows]);

  const hasErrors = useMemo(() => validation.some((v) => v.some((e) => !e.includes('test_set_id'))), [validation]);

  const handleUpload = useCallback(async () => {
    setUploading(true);
    try {
      const tenants = rows.map((r) => ({
        name: r.nombre,
        email: r.email,
        phone: r.telefono || null,
        address: r.direccion || null,
        tax_id: r.nit || null,
        tax_id_type: r.nit ? 'NIT' : null,
        business_name: r.nombre,
        state: r.departamento || null,
        city: r.municipio || null,
        tax_responsibility: r.responsabilidad_fiscal || null,
        needs_electronic_invoice: r.facturacion_electronica === 'si',
      }));

      const res: any = await api.post('/tenants/bulk', { tenants });
      const data = res?.data ?? res;
      setResults(data);
      setStep(3);
    } catch (e: any) {
      setResults({
        success: 0,
        errors: rows.length,
        details: [{ name: 'Error general', status: 'error', message: e?.response?.data?.error || e?.message || 'Error al procesar la carga masiva' }],
      });
      setStep(3);
    } finally {
      setUploading(false);
    }
  }, [rows]);

  const handleConfigureElectronicInvoice = useCallback(async (companyName: string, tenantId: string) => {
    const testSetResult = await Swal.fire({
      title: `Configurar Fact. Electronica`,
      html: `<p style="font-size:13px;color:#666;margin-bottom:8px"><b>${companyName}</b></p><p style="font-size:13px;color:#666">Ingresa el Test Set ID de la DIAN para esta empresa.</p>`,
      input: 'text',
      inputPlaceholder: 'Ej: SET-ABC123',
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#6366f1',
      footer: '<a href="#" id="swal-help-chat-bulk" style="font-size:12px">¿Necesitas ayuda? Habla con nuestra asesora tributaria</a>',
      inputValidator: (value) => {
        if (!value || !value.trim()) return 'Por favor ingresa el Test Set ID';
        return null;
      },
      didOpen: () => {
        const helpLink = document.getElementById('swal-help-chat-bulk');
        if (helpLink) {
          helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            Swal.close();
            window.dispatchEvent(new CustomEvent('openCrumiChat', {
              detail: {
                agentId: 'tributario',
                message: `Necesito ayuda para configurar facturacion electronica para la empresa ${companyName}. ¿Como obtengo el Test Set ID de la DIAN?`,
              },
            }));
          });
        }
      },
    });
    if (testSetResult.isConfirmed && testSetResult.value) {
      try {
        await api.put(`/tenants/${tenantId}`, { needs_electronic_invoice: true });
        Swal.fire({ icon: 'success', title: 'Configurado', text: `Test Set ID guardado para ${companyName}.`, timer: 2000, showConfirmButton: false });
      } catch {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo guardar la configuracion.' });
      }
    }
  }, []);

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted mb-0">
          Sube un archivo CSV con los datos de las empresas a crear.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
            text-crumi-accent border border-crumi-accent/30 hover:bg-crumi-accent/5 transition-colors"
        >
          <i className="ri-download-2-line text-sm" />
          Descargar plantilla
        </button>
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
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive
                ? 'border-crumi-accent bg-crumi-accent/5'
                : 'border-gray-200 dark:border-gray-700 hover:border-crumi-accent/50'
              }`}
          >
            <input {...getInputProps()} />
            <i className="ri-upload-cloud-2-line text-3xl text-crumi-accent mb-2" />
            <p className="text-xs text-crumi-text-primary dark:text-white font-medium mb-1">
              {isDragActive ? 'Suelta el archivo aqui...' : 'Arrastra tu archivo Excel o CSV, o haz click para seleccionar'}
            </p>
            <p className="text-[10px] text-crumi-text-muted dark:text-crumi-text-dark-muted mb-0">
              Formatos soportados: .xlsx, .xls, .csv
            </p>
          </div>
        )}
      </Dropzone>

      {parseError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-xs text-red-600 dark:text-red-400 mb-0">{parseError}</p>
        </div>
      )}

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mb-1">Columnas esperadas:</p>
        <p className="text-[10px] text-blue-600 dark:text-blue-400 mb-0 font-mono">
          {CSV_HEADERS.join(', ')}
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-crumi-text-muted dark:text-crumi-text-dark-muted mb-0">
          {rows.length} empresa{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}
        </p>
        <button
          type="button"
          onClick={() => { setRows([]); setStep(1); }}
          className="text-[11px] text-crumi-accent hover:underline"
        >
          Cambiar archivo
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="px-2 py-2 text-left font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted">Nombre</th>
              <th className="px-2 py-2 text-left font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted">NIT</th>
              <th className="px-2 py-2 text-left font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted">Email</th>
              <th className="px-2 py-2 text-left font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted">Fact. Elect.</th>
              <th className="px-2 py-2 text-left font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted">Estado</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const errs = validation[idx];
              const hasRowErrors = errs.length > 0;
              const isWarningOnly = errs.every((e) => e.includes('test_set_id'));
              return (
                <tr key={idx} className={`border-t border-gray-100 dark:border-gray-700/50 ${hasRowErrors && !isWarningOnly ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                  <td className="px-2 py-1.5 text-crumi-text-primary dark:text-white">{r.nombre || <span className="text-red-400 italic">vacio</span>}</td>
                  <td className="px-2 py-1.5 text-crumi-text-primary dark:text-white font-mono">{r.nit || <span className="text-red-400 italic">vacio</span>}</td>
                  <td className="px-2 py-1.5 text-crumi-text-primary dark:text-white">{r.email || <span className="text-red-400 italic">vacio</span>}</td>
                  <td className="px-2 py-1.5">
                    {r.facturacion_electronica === 'si' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        <i className="ri-check-line" /> Si
                      </span>
                    ) : (
                      <span className="text-crumi-text-muted dark:text-crumi-text-dark-muted">No</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {hasRowErrors ? (
                      <span className={`text-[10px] font-medium ${isWarningOnly ? 'text-amber-500' : 'text-red-500'}`}>
                        {errs.join(', ')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-500 font-medium">OK</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(idx)} className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-colors">
                      <i className="ri-delete-bin-line text-sm" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-center text-crumi-text-muted dark:text-crumi-text-dark-muted py-4">
          No quedan filas. Sube otro archivo.
        </p>
      )}
    </div>
  );

  const renderStep3 = () => {
    if (!results) return null;
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-0">{results.success}</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-0">Creadas</p>
          </div>
          {results.errors > 0 && (
            <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-0">{results.errors}</p>
              <p className="text-[10px] text-red-600 dark:text-red-400 mb-0">Errores</p>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-2">
          {results.details.map((d, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between rounded-lg p-3 border ${
                d.status === 'created'
                  ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <i className={`text-base ${d.status === 'created' ? 'ri-check-circle-line text-emerald-500' : 'ri-close-circle-line text-red-500'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-crumi-text-primary dark:text-white mb-0 truncate">{d.name}</p>
                  {d.status === 'error' && d.message && (
                    <p className="text-[10px] text-red-500 mb-0 truncate">{d.message}</p>
                  )}
                </div>
              </div>
              {d.status === 'created' && d.needs_electronic_invoice && (
                <button
                  type="button"
                  onClick={() => handleConfigureElectronicInvoice(d.name, d.tenant_id || '')}
                  className="shrink-0 ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
                    text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800
                    hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                >
                  <i className="ri-settings-3-line" />
                  Configurar Fact. Elect.
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const stepTitles = {
    1: 'Subir archivo Excel o CSV',
    2: 'Previsualizar datos',
    3: 'Resultados',
  };

  const stepSubtitles = {
    1: 'Importa multiples empresas desde un archivo Excel (.xlsx) o CSV',
    2: 'Revisa los datos antes de crear las empresas',
    3: 'Resumen de la carga masiva',
  };

  const renderFooter = () => {
    if (step === 1) return undefined; // No custom footer for step 1

    if (step === 2) {
      return (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/40">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-crumi-text-muted dark:text-crumi-text-dark-muted hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Atras
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || rows.length === 0 || hasErrors}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-crumi-accent text-white
              hover:bg-crumi-accent/90 hover:shadow-md hover:shadow-crumi-accent/20 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {uploading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {uploading ? 'Creando empresas...' : `Crear ${rows.length} empresa${rows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      );
    }

    // Step 3
    return (
      <div className="flex items-center justify-end px-5 py-3 border-t border-gray-100 dark:border-gray-700/40">
        <button
          type="button"
          onClick={() => { onComplete?.(); handleClose(); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-crumi-accent text-white
            hover:bg-crumi-accent/90 hover:shadow-md hover:shadow-crumi-accent/20 transition-all"
        >
          Cerrar
        </button>
      </div>
    );
  };

  return (
    <CrumiModal
      isOpen={isOpen}
      toggle={handleClose}
      title={`Carga Masiva — ${stepTitles[step]}`}
      subtitle={stepSubtitles[step]}
      size="lg"
      footer={renderFooter()}
    >
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </CrumiModal>
  );
};

export default BulkUploadModal;
