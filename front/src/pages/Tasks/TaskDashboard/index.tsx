
import React, { useState, useEffect } from 'react';
import { Container, Row, Card, CardBody, Input, Button, UncontrolledTooltip, Modal, ModalHeader, ModalBody, ModalFooter, Form, FormGroup, Label } from 'reactstrap';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import EmployeeKanban from '../EmployeeKanban';
import { api } from "../../../services/api";
import { getToken } from "../../../services/auth";
import { jwtDecode } from "jwt-decode";
// import SimpleBar from 'simplebar-react'; // Optional for scrolling avatars if many employees

// Default avatars or initials helper
const UserAvatar = ({ user, onClick, isActive }: { user: any, onClick: () => void, isActive: boolean }) => {
    const name = user.first_name || "U";
    const initials = name.substring(0, 2).toUpperCase();
    return (
        <div
            className={`avatar-group-item ${isActive ? 'active-filter' : ''}`}
            onClick={onClick}
            style={{ cursor: 'pointer', border: isActive ? '2px solid #4b38b3' : '2px solid transparent', borderRadius: '50%' }}
        >
            <div className="avatar-xs" id={`tooltip-${user.id}`}>
                {user.avatar ? (
                    <img src={user.avatar} alt="" className="rounded-circle img-fluid" />
                ) : (
                    <div className="avatar-title rounded-circle bg-info text-white">
                        {initials}
                    </div>
                )}
            </div>
            <UncontrolledTooltip placement="top" target={`tooltip-${user.id}`}>
                {user.first_name} {user.last_name}
            </UncontrolledTooltip>
        </div>
    );
};

const TaskDashboard = () => {
    const [employees, setEmployees] = useState<any[]>([]);
    const [assigneeId, setAssigneeId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Column Management (Admin Only)
    const [modalCol, setModalCol] = useState(false);
    const [colTitle, setColTitle] = useState("");
    const [colOrder, setColOrder] = useState(0);

    const toggleColModal = () => setModalCol(!modalCol);

    useEffect(() => {
        const token = getToken();
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                if (decoded?.user?.role_id === 99) setIsSuperAdmin(true);

                // Load Employees
                const tenantId = decoded?.user?.tenant_id || decoded?.tenant_id;
                if (tenantId) {
                    api.get(`/users/tenant/${tenantId}?role_ids=2,3`).then(({ data }) => {
                        setEmployees(Array.isArray(data) ? data : []);
                    });
                }
            } catch (e) { console.error(e); }
        }
    }, []);

    const handleCreateColumn = async () => {
        try {
            // Auto-generate status_key from title
            const statusKey = colTitle.toLowerCase()
                .replace(/[áäâà]/g, 'a')
                .replace(/[éëêè]/g, 'e')
                .replace(/[íïîì]/g, 'i')
                .replace(/[óöôò]/g, 'o')
                .replace(/[úüûù]/g, 'u')
                .replace(/ñ/g, 'n')
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_+|_+$/g, '');

            await api.post('/columns', { title: colTitle, status_key: statusKey, display_order: colOrder });
            setColTitle("");
            toggleColModal();
            window.location.reload();
        } catch (e) { console.error(e); }
    };

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Gestión de Actividades" pageTitle="Gestión" />

                    <Card>
                        <CardBody>
                            <Row className="g-2">
                                <div className="col-lg-auto">
                                    <div className="hstack gap-2">
                                        {isSuperAdmin && (
                                            <>
                                                <button className="btn btn-primary" onClick={toggleColModal}>
                                                    <i className="ri-add-line align-bottom me-1"></i> Nueva Columna
                                                </button>
                                                <button
                                                    className="btn btn-success"
                                                    onClick={() => window.location.href = '/settings?tab=2'}
                                                >
                                                    <i className="ri-user-add-line align-bottom me-1"></i> Nuevo Personal
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="col-lg-3 col-auto">
                                    <div className="search-box">
                                        <input
                                            type="text"
                                            className="form-control search"
                                            placeholder="Search for tasks..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                        <i className="ri-search-line search-icon"></i>
                                    </div>
                                </div>
                                <div className="col-auto ms-sm-auto">
                                    <div className="avatar-group" id="newMembar">
                                        <div
                                            className={`avatar-group-item ${assigneeId === null ? 'active-filter' : ''}`}
                                            onClick={() => setAssigneeId(null)}
                                            style={{ cursor: 'pointer' }}
                                            data-bs-toggle="tooltip"
                                            title="Ver Todos"
                                        >
                                            <div className="avatar-xs">
                                                <div className="avatar-title rounded-circle bg-light text-primary">
                                                    ALL
                                                </div>
                                            </div>
                                        </div>
                                        {employees.map(user => (
                                            <UserAvatar
                                                key={user.id}
                                                user={user}
                                                isActive={assigneeId === user.id}
                                                onClick={() => setAssigneeId(user.id === assigneeId ? null : user.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </Row>
                        </CardBody>
                    </Card>

                    <EmployeeKanban
                        assigneeId={assigneeId}
                        searchTerm={searchTerm}
                        isSuperAdmin={isSuperAdmin}
                    />

                    {/* Modal Create Column */}
                    <Modal isOpen={modalCol} toggle={toggleColModal}>
                        <ModalHeader toggle={toggleColModal}>Crear Nueva Columna</ModalHeader>
                        <ModalBody>
                            <Form>
                                <FormGroup>
                                    <Label>Título Visible</Label>
                                    <Input value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="Ej: Por Hacer" />
                                </FormGroup>

                                <FormGroup>
                                    <Label>Orden</Label>
                                    <Input type="number" value={colOrder} onChange={e => setColOrder(Number(e.target.value))} />
                                </FormGroup>
                            </Form>
                        </ModalBody>
                        <ModalFooter>
                            <Button color="secondary" onClick={toggleColModal}>Cancelar</Button>
                            <Button color="primary" onClick={handleCreateColumn}>Crear</Button>
                        </ModalFooter>
                    </Modal>

                </Container>
            </div>
        </React.Fragment>
    );
};

export default TaskDashboard;
