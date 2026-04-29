// src/Components/Common/NuevoTerceroModal.tsx
// Modal reutilizable para "Nuevo tercero" con multi-select de roles.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';

export type TpKind = 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'OTHER';

const OPTS: Array<{ value: TpKind; label: string; desc: string }> = [
  { value: 'CUSTOMER', label: 'Cliente',   desc: 'Compra productos/servicios a tu empresa' },
  { value: 'SUPPLIER', label: 'Proveedor', desc: 'Te factura productos/servicios' },
  { value: 'EMPLOYEE', label: 'Empleado',  desc: 'Personal interno (nómina)' },
  { value: 'OTHER',    label: 'Otro',      desc: 'Socio, accionista, banco, etc.' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultKind?: TpKind;
}

const NuevoTerceroModal: React.FC<Props> = ({ isOpen, onClose, defaultKind = 'CUSTOMER' }) => {
  const navigate = useNavigate();
  const [kinds, setKinds] = useState<TpKind[]>([defaultKind]);

  const toggle = (k: TpKind) => {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const handleContinue = () => {
    if (kinds.length === 0) return;
    onClose();
    navigate('/terceros-hub/nuevo', { state: { kind: kinds[0], kinds } });
    // reset for next time
    setKinds([defaultKind]);
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} centered>
      <ModalHeader toggle={onClose}>Agregar tercero</ModalHeader>
      <ModalBody>
        <Label className="fs-13 fw-medium mb-2">Tipo(s) de tercero</Label>
        <div className="text-muted fs-12 mb-3">
          Marca uno o más roles. Un mismo tercero puede ser cliente <strong>y</strong> proveedor a la vez.
        </div>
        <div className="d-flex flex-column gap-2">
          {OPTS.map((opt) => (
            <FormGroup check key={opt.value} className="mb-0">
              <Input
                type="checkbox"
                id={`tpm-${opt.value}`}
                checked={kinds.includes(opt.value)}
                onChange={() => toggle(opt.value)}
              />
              <Label check htmlFor={`tpm-${opt.value}`} className="fs-14">
                <span className="fw-medium">{opt.label}</span>
                <span className="text-muted fs-12 ms-2">— {opt.desc}</span>
              </Label>
            </FormGroup>
          ))}
        </div>
        <div className="text-muted fs-12 mt-3">
          Después de continuar capturas los datos completos del tercero (NIT, contacto, dirección, etc.).
        </div>
      </ModalBody>
      <ModalFooter>
        <Button color="light" onClick={onClose}>Cancelar</Button>
        <Button color="primary" onClick={handleContinue} disabled={kinds.length === 0}>
          Continuar →
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default NuevoTerceroModal;
