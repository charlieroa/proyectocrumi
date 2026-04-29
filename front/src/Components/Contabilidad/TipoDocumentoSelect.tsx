import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Col,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Row,
} from 'reactstrap';
import Swal from 'sweetalert2';
import {
  TIPOS_LS_KEY,
  TipoDocumento,
  TipoDocumentoApplies,
  addTipo,
  filterTipos,
  loadTipos,
} from './TiposDocumento';

type Size = 'sm' | 'lg';

type Props = {
  value: string;
  onChange: (code: string) => void;
  filter: TipoDocumentoApplies;
  size?: Size;
  disabled?: boolean;
  id?: string;
  includeAllOption?: boolean; // si true agrega "Todos" con value=''
  allOptionLabel?: string;
};

const NEW_SENTINEL = '__new__';

const TipoDocumentoSelect: React.FC<Props> = ({
  value,
  onChange,
  filter,
  size,
  disabled,
  id,
  includeAllOption,
  allOptionLabel,
}) => {
  const [tipos, setTipos] = useState<TipoDocumento[]>(() => loadTipos());
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TipoDocumento>({
    code: '',
    name: '',
    applies: filter === 'ambos' ? 'ambos' : filter,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Mantenemos sincronizados entre pestañas / otros componentes que tocan LS.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TIPOS_LS_KEY) setTipos(loadTipos());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const visible = useMemo(() => filterTipos(tipos, filter), [tipos, filter]);

  const openNew = useCallback(() => {
    setForm({
      code: '',
      name: '',
      applies: filter === 'ambos' ? 'ambos' : filter,
    });
    setFormError(null);
    setModalOpen(true);
  }, [filter]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === NEW_SENTINEL) {
      openNew();
      return;
    }
    onChange(v);
  };

  const submitNew = () => {
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    if (!code || !name) {
      setFormError('Código y nombre son obligatorios.');
      return;
    }
    const exists = tipos.find((t) => t.code === code);
    if (exists) {
      setFormError(`Ya existe un tipo con código "${code}".`);
      return;
    }
    const next = addTipo({ code, name, applies: form.applies });
    setTipos(next);
    setModalOpen(false);
    onChange(code);
    Swal.fire({
      icon: 'success',
      title: 'Tipo de documento creado',
      text: `${code} — ${name}`,
      confirmButtonColor: '#1A1D1F',
      timer: 1500,
    });
  };

  return (
    <>
      <Input
        id={id}
        type="select"
        value={value}
        onChange={handleSelectChange}
        bsSize={size}
        disabled={disabled}
      >
        {includeAllOption && (
          <option value="">{allOptionLabel || 'Todos'}</option>
        )}
        {visible.map((t) => (
          <option key={t.code} value={t.code}>
            {t.code} — {t.name}
          </option>
        ))}
        <option value={NEW_SENTINEL}>+ Crear nuevo tipo…</option>
      </Input>

      <Modal
        isOpen={modalOpen}
        toggle={() => setModalOpen(false)}
        centered
        size="md"
      >
        <ModalHeader toggle={() => setModalOpen(false)}>
          Nuevo tipo de documento
        </ModalHeader>
        <ModalBody>
          {formError && (
            <div className="alert alert-danger py-2 small mb-3">
              <i className="ri-error-warning-line me-1" />
              {formError}
            </div>
          )}
          <Row className="g-3">
            <Col md={4}>
              <Label className="form-label">Código / Prefijo *</Label>
              <Input
                type="text"
                placeholder="Ej: FC, DSA, FV, NC"
                value={form.code}
                maxLength={10}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    code: e.target.value.toUpperCase(),
                  }))
                }
              />
            </Col>
            <Col md={8}>
              <Label className="form-label">Nombre *</Label>
              <Input
                type="text"
                placeholder="Ej: Factura de compra"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Col>
            <Col md={12}>
              <Label className="form-label">Aplica a</Label>
              <Input
                type="select"
                value={form.applies}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    applies: e.target.value as TipoDocumentoApplies,
                  }))
                }
              >
                <option value="compra">Compras</option>
                <option value="venta">Ventas</option>
                <option value="ambos">Ambos</option>
              </Input>
              <small className="text-muted">
                Define en qué pantallas aparecerá este tipo de documento.
              </small>
            </Col>
          </Row>
        </ModalBody>
        <ModalFooter>
          <Button color="light" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button color="primary" onClick={submitNew}>
            <i className="ri-save-line me-1" />
            Guardar tipo
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default TipoDocumentoSelect;
