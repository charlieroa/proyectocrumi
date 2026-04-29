
// Archivo: src/pages/Settings/personal.tsx
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import React, { useEffect, useMemo, useState } from "react";
import {
  Button, Spinner, Table, Modal, ModalHeader, ModalBody, ModalFooter,
  Row, Col, Input, Label, Alert, Pagination, PaginationItem, PaginationLink
} from "reactstrap";
import { jwtDecode } from "jwt-decode";
import { api } from "../../../../services/api";
import { getToken } from "../../../../services/auth";

/* =========================
   Tipos
========================= */
type Staff = {
  id: string;
  tenant_id?: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role_id: number;
  is_active?: boolean;
};

// Simplified props - removed categories and services as they are no longer needed
interface PersonalProps {
  services?: any[]; // Kept for compatibility if parent passes it, but ignored
  categories?: any[];
  onStaffChange: () => void;
}

/* =========================
   Helpers
========================= */
const decodeTenantId = (): string | null => {
  try {
    const t = getToken();
    if (!t) return null;
    const decoded: any = jwtDecode(t);
    return decoded?.user?.tenant_id || decoded?.tenant_id || null;
  } catch { return null; }
};

/* =========================
   Componente Modal Simplificado
========================= */
const StaffModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  tenantId: string;
  edit?: Staff | null;
}> = ({ isOpen, onClose, onSaved, tenantId, edit }) => {
  const [saving, setSaving] = useState(false);

  // Default Role ID 3 (Employee/Estilista in DB, but generically 'Employee' for UI)
  const roleId = 3;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const isEditing = !!edit;
    setFirstName(isEditing ? edit.first_name : "");
    setLastName(isEditing ? edit.last_name || "" : "");
    setEmail(isEditing ? edit.email || "" : "");
    setPhone(isEditing ? edit.phone || "" : "");
    setPassword("");
    setShowPass(false);
  }, [isOpen, edit]);

  const save = async () => {
    if (!firstName.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'El nombre es obligatorio.' });
      return;
    }

    setSaving(true);
    try {
      const baseBody = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        role_id: roleId,
      };

      if (edit) {
        const updateBody: any = { ...baseBody };
        if (password.trim()) {
          updateBody.password = password.trim();
        }
        await api.put(`/users/${edit.id}`, updateBody);
      } else {
        if (!password.trim()) {
          Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'La contraseña es obligatoria.' });
          setSaving(false);
          return;
        }
        const createBody = {
          ...baseBody,
          tenant_id: tenantId,
          password: password.trim(),
        };
        await api.post(`/users`, createBody);
      }

      Swal.fire({
        icon: 'success',
        title: edit ? '¡Empleado actualizado!' : '¡Empleado creado!',
        showConfirmButton: false,
        timer: 1500
      });

      onSaved();
      onClose();
    } catch (e: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: e?.response?.data?.message || e?.response?.data?.error || e?.message || 'No se pudo guardar el empleado'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={onClose} size="md" centered>
      <ModalHeader toggle={onClose}>{edit ? `Editar Empleado` : `Nuevo Empleado`}</ModalHeader>
      <ModalBody>
        <Row className="g-3">
          <Col md={12}>
            <Label className="form-label">Nombre</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ej: Juan" />
          </Col>
          <Col md={12}>
            <Label className="form-label">Apellido</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ej: Pérez" />
          </Col>
          <Col md={12}>
            <Label className="form-label">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@example.com" />
          </Col>
          <Col md={12}>
            <Label className="form-label">Teléfono</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="3001234567" />
          </Col>

          <Col md={12}>
            <Label className="form-label">{edit ? "Nueva Contraseña (opcional)" : "Contraseña"}</Label>
            <div className="input-group">
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={edit ? "Dejar en blanco para mantener" : "••••••••"}
              />
              <Button type="button" color="light" onClick={() => setShowPass(v => !v)} title={showPass ? "Ocultar" : "Mostrar"}>
                <i className={showPass ? "ri-eye-off-line" : "ri-eye-line"} />
              </Button>
            </div>
          </Col>
        </Row>
      </ModalBody>
      <ModalFooter>
        <Button color="secondary" onClick={onClose}>Cancelar</Button>
        <Button color="primary" onClick={save} disabled={saving}>
          {saving && <Spinner size="sm" className="me-2" />} Guardar
        </Button>
      </ModalFooter>
    </Modal>
  );
};

const Personal: React.FC<PersonalProps> = ({ onStaffChange }) => {
  const tenantId = useMemo(() => decodeTenantId() || "", []);
  const [error, setError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [stModalOpen, setStModalOpen] = useState(false);
  const [stEdit, setStEdit] = useState<Staff | null>(null);
  const PAGE_SIZE = 6;
  const [page, setPage] = useState<number>(1);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(staff.length / PAGE_SIZE)), [staff.length]);
  const paginatedStaff = useMemo(() => staff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [staff, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (staff.length === 0) setPage(1);
  }, [staff.length, totalPages, page]);

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      // Fetch users with roles 2 or 3 (assuming we want to see existing ones too, or just simplify everything to 3)
      // Kept both for now to not lose visibility of existing Cajeros, but UI treats them same
      const { data } = await api.get(`/users/tenant/${tenantId}`, { params: { role_ids: '2,3' } });
      const allStaff = Array.isArray(data) ? data : [];
      const filteredStaff = allStaff.filter(user => user.role_id === 2 || user.role_id === 3);
      setStaff(filteredStaff);
      setPage(1);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'No se pudo cargar el personal');
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    loadStaff();
  }, [tenantId]);

  const refreshStaff = async () => {
    await loadStaff();
    onStaffChange();
  };

  const openNewStaff = () => { setStEdit(null); setStModalOpen(true); };
  const openEditStaff = (u: Staff) => { setStEdit(u); setStModalOpen(true); };

  const deleteStaff = async (u: Staff) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a eliminar a ${u.first_name}${u.last_name ? ` ${u.last_name}` : ""}. ¡Esta acción no se puede deshacer!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, ¡eliminar!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/users/${u.id}`);
        await refreshStaff();
        Swal.fire('¡Eliminado!', 'El empleado ha sido eliminado.', 'success');
      } catch (e: any) {
        Swal.fire({ icon: 'error', title: 'Error', text: e?.response?.data?.message || e?.message || 'No se pudo eliminar el personal.' });
      }
    }
  };

  const renderPageNumbers = () => {
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = start + windowSize - 1;
    if (end > totalPages) { end = totalPages; start = Math.max(1, end - windowSize + 1); }
    const items = [];
    for (let p = start; p <= end; p++) {
      items.push(<PaginationItem key={p} active={p === page}><PaginationLink onClick={() => setPage(p)}>{p}</PaginationLink></PaginationItem>);
    }
    return items;
  };

  return (
    <div>
      {error && <Alert color="danger" fade={false}>{error}</Alert>}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Personal</h5>
        <div className="d-flex align-items-center gap-2">
          {staffLoading && <Spinner size="sm" />}
          <Button color="primary" onClick={openNewStaff}>
            <i className="ri-add-line me-1" /> Nuevo Empleado
          </Button>
        </div>
      </div>
      <div className="table-responsive">
        <Table hover className="align-middle">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStaff.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted">Sin personal registrado</td></tr>
            )}
            {paginatedStaff.map(u => (
              <tr key={u.id}>
                <td className="fw-semibold">{u.first_name} {u.last_name || ""}</td>
                <td>{u.email || "—"}</td>
                <td>{u.phone || "—"}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button size="sm" color="soft-info" tag="a" href={`/apps/tasks/${u.id}`} title="Ver Tareas">
                      <i className="ri-task-line" />
                    </Button>
                    <Button size="sm" color="soft-primary" onClick={() => openEditStaff(u)}><i className="ri-edit-line" /></Button>
                    <Button size="sm" color="soft-danger" onClick={() => deleteStaff(u)}><i className="ri-delete-bin-line" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="d-flex justify-content-end">
        <Pagination className="pagination-separated mb-0">
          <PaginationItem disabled={page === 1}><PaginationLink first onClick={() => setPage(1)} /></PaginationItem>
          <PaginationItem disabled={page === 1}><PaginationLink previous onClick={() => setPage(p => Math.max(1, p - 1))} /></PaginationItem>
          {renderPageNumbers()}
          <PaginationItem disabled={page === totalPages}><PaginationLink next onClick={() => setPage(p => Math.min(totalPages, p + 1))} /></PaginationItem>
          <PaginationItem disabled={page === totalPages}><PaginationLink last onClick={() => setPage(totalPages)} /></PaginationItem>
        </Pagination>
      </div>

      <StaffModal
        isOpen={stModalOpen}
        onClose={() => setStModalOpen(false)}
        onSaved={refreshStaff}
        tenantId={tenantId}
        edit={stEdit}
      />
    </div>
  );
};

export default Personal;