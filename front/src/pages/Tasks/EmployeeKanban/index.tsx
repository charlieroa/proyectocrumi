
import React, { useState, useEffect, useCallback } from 'react';
import {
    CardBody, Button,
    Modal, ModalHeader, ModalBody, Form, FormGroup, Label, Input, Spinner,
    Row, Col,
    UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem
} from 'reactstrap';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { api } from "../../../services/api";
import { getToken } from "../../../services/auth";
import { jwtDecode } from "jwt-decode";
import moment from 'moment';
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";

interface Task {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: 'low' | 'medium' | 'high';
    due_date?: string;
    assigned_to?: string;
    assignee_name?: string;
}

interface ColumnDef {
    id: string;
    title: string;
    status_key: string;
    color?: string;
}

interface EmployeeKanbanProps {
    assigneeId?: string | null;
    searchTerm?: string;
    isSuperAdmin?: boolean;
    employeeIdProp?: string;
}

const EmployeeKanban = ({ assigneeId, searchTerm = "", isSuperAdmin = false, employeeIdProp }: EmployeeKanbanProps) => {
    // Legacy support
    const effectiveAssigneeId = assigneeId || employeeIdProp;

    const [tasks, setTasks] = useState<Task[]>([]);
    const [columns, setColumns] = useState<ColumnDef[]>([]);
    const [loading, setLoading] = useState(true);

    // Create Modal
    const [modalOpen, setModalOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Task>>({ status: 'pending', priority: 'medium' });
    const [targetAssignee, setTargetAssignee] = useState<string>("");

    // Edit Modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Employees list for the modal
    const [employees, setEmployees] = useState<any[]>([]);

    const getCurrentUserId = () => {
        try {
            const t = getToken();
            if (t) {
                const d: any = jwtDecode(t);
                return d?.user?.id || d?.id;
            }
        } catch { }
        return null;
    };

    const fetchColumns = async () => {
        try {
            const { data } = await api.get('/columns');
            if (Array.isArray(data) && data.length > 0) {
                setColumns(data);
            } else {
                setColumns([
                    { id: 'def1', title: 'Pendiente', status_key: 'pending', color: 'warning' },
                    { id: 'def2', title: 'En Progreso', status_key: 'in_progress', color: 'info' },
                    { id: 'def3', title: 'Completado', status_key: 'done', color: 'success' },
                ]);
            }
        } catch (e) { console.error("Error fetching columns", e); }
    };

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            let url = '/tasks';
            const params: any = {};

            if (isSuperAdmin) {
                if (effectiveAssigneeId) {
                    params.assigned_to = effectiveAssigneeId;
                }
            } else {
                const myId = getCurrentUserId();
                if (myId) {
                    url = `/tasks/user/${myId}`;
                }
            }

            const { data } = await api.get(url, { params });
            if (Array.isArray(data)) setTasks(data);

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [effectiveAssigneeId, isSuperAdmin]);

    useEffect(() => {
        fetchColumns();
        if (isSuperAdmin) {
            const t = getToken();
            try {
                const d: any = jwtDecode(t || "");
                const tid = d?.user?.tenant_id || d?.tenant_id;
                if (tid) {
                    api.get(`/users/tenant/${tid}?role_ids=2,3`).then(res => setEmployees(res.data));
                }
            } catch { }
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        fetchTasks();
    }, [effectiveAssigneeId, isSuperAdmin, fetchTasks]);

    // Derived state for board
    const boardColumns = columns.map(col => ({
        ...col,
        tasks: tasks.filter(t =>
            t.status === col.status_key &&
            t.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }));

    const onDragEnd = async (result: any) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        const destCol = columns.find(c => c.id === destination.droppableId);
        if (!destCol) return;

        const newStatus = destCol.status_key;

        // Optimistic Update
        const updatedTasks = tasks.map(t =>
            t.id === draggableId ? { ...t, status: newStatus } : t
        );
        setTasks(updatedTasks);

        try {
            await api.put(`/tasks/${draggableId}`, { status: newStatus });
        } catch (e) {
            console.error("Failed to update task status", e);
            fetchTasks();
        }
    };

    // Create Logic
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();

        let assignee = effectiveAssigneeId;
        if (!assignee) {
            if (isSuperAdmin) assignee = targetAssignee;
            else assignee = getCurrentUserId() || "";
        }

        if (!assignee) {
            Swal.fire({
                icon: 'info',
                title: 'Por favor selecciona un empleado para asignar la tarea.',
                confirmButtonColor: '#1A1D1F',
            });
            return;
        }

        try {
            await api.post('/tasks', { ...formData, assigned_to: assignee });
            setModalOpen(false);
            setFormData({ status: 'pending', priority: 'medium', title: '', description: '' });
            fetchTasks();
        } catch (e) { console.error(e) }
    };

    // Edit Logic
    const openEditModal = (task: Task) => {
        setSelectedTask(task);
        setFormData({
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: task.status,
            assigned_to: task.assigned_to
        });
        setEditModalOpen(true);
    };

    const handleUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTask) return;
        try {
            await api.put(`/tasks/${selectedTask.id}`, formData);
            setEditModalOpen(false);
            fetchTasks();
        } catch (e) { console.error(e); }
    };

    const handleDeleteTask = async () => {
        if (!selectedTask) return;
        const confirmRes = await Swal.fire({
            icon: 'question',
            title: '¿Confirmar?',
            text: '¿Estás seguro de eliminar esta tarea?',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#1A1D1F',
        });
        if (!confirmRes.isConfirmed) return;
        try {
            await api.delete(`/tasks/${selectedTask.id}`);
            setEditModalOpen(false);
            fetchTasks();
        } catch (e) { console.error(e); }
    };

    return (
        <React.Fragment>
            <div className="tasks-board mb-3 d-flex" id="kanbanboard">
                {loading ? <Spinner /> : (
                    <DragDropContext onDragEnd={onDragEnd}>
                        {boardColumns.map(col => (
                            <div className="tasks-list" key={col.id}>
                                <div className="d-flex mb-3">
                                    <div className="flex-grow-1">
                                        <h6 className="fs-14 text-uppercase fw-semibold mb-0">
                                            {col.title} <span className={`badge bg-${col.color || 'primary'} align-bottom ms-1 totaltask-badge`}>{col.tasks.length}</span>
                                        </h6>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {/* Optional Dropdown for column actions */}
                                    </div>
                                </div>
                                <div className="tasks-wrapper px-3 mx-n3">
                                    <SimpleBar style={{ maxHeight: "calc(100vh - 418px)" }}>
                                        <div className="tasks">
                                            <Droppable droppableId={col.id}>
                                                {(provided: any, snapshot: any) => (
                                                    <div
                                                        {...provided.droppableProps}
                                                        ref={provided.innerRef}
                                                        className={snapshot.isDraggingOver ? 'bg-light-subtle' : ''}
                                                        style={{ minHeight: '200px' }}
                                                    >
                                                        {col.tasks.map((task, index) => (
                                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                                {(provided: any, snapshot: any) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        className="pb-1 task-list"
                                                                    >
                                                                        <div
                                                                            className="card tasks-box"
                                                                            onClick={() => openEditModal(task)}
                                                                            style={{ cursor: 'pointer' }}
                                                                        >
                                                                            <CardBody>
                                                                                <div className="d-flex mb-2">
                                                                                    <h6 className="fs-15 mb-0 flex-grow-1 text-truncate task-title">{task.title}</h6>
                                                                                    <UncontrolledDropdown direction="start">
                                                                                        <DropdownToggle tag="a" id="dropdownMenuLink1" role="button">
                                                                                            <i className="ri-more-fill" />
                                                                                        </DropdownToggle>
                                                                                        <DropdownMenu>
                                                                                            <DropdownItem onClick={() => openEditModal(task)}><i className="ri-eye-fill align-bottom me-2 text-muted" /> View</DropdownItem>
                                                                                            <DropdownItem onClick={() => openEditModal(task)}><i className="ri-pencil-fill align-bottom me-2 text-muted" /> Edit</DropdownItem>
                                                                                            <DropdownItem onClick={() => handleDeleteTask()}><i className="ri-delete-bin-5-fill align-bottom me-2 text-muted" /> Delete</DropdownItem>
                                                                                        </DropdownMenu>
                                                                                    </UncontrolledDropdown>
                                                                                </div>
                                                                                <p className="text-muted">{task.description}</p>

                                                                                {/* Progress Bar (Mocked for visual parity if needed, or omit) */}
                                                                                <div className="mb-3">
                                                                                    <div className="d-flex mb-1">
                                                                                        <div className="flex-grow-1">
                                                                                            <h6 className="text-muted mb-0"><span className="text-secondary">15%</span> of 100%</h6>
                                                                                        </div>
                                                                                        <div className="flex-shrink-0">
                                                                                            <span className="text-muted">{moment(task.due_date).format("D MMM, YYYY")}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="progress rounded-3 progress-sm">
                                                                                        <div className="progress-bar bg-danger" role="progressbar" style={{ width: "15%" }} aria-valuenow={15} aria-valuemin={0} aria-valuemax={100} />
                                                                                    </div>
                                                                                </div>

                                                                                <div className="d-flex align-items-center justify-content-between">
                                                                                    <div className="flex-grow-1">
                                                                                        {task.priority === 'high' && <span className="badge bg-danger-subtle text-danger text-uppercase">High</span>}
                                                                                        {task.priority === 'medium' && <span className="badge bg-warning-subtle text-warning text-uppercase">Medium</span>}
                                                                                        {task.priority === 'low' && <span className="badge bg-success-subtle text-success text-uppercase">Low</span>}
                                                                                    </div>
                                                                                    <div className="flex-shrink-0">
                                                                                        <div className="avatar-group">
                                                                                            {task.assigned_to && (
                                                                                                <div className="avatar-group-item">
                                                                                                    <div className="avatar-xs">
                                                                                                        <div className="avatar-title rounded-circle bg-secondary">
                                                                                                            {task.assigned_to.charAt(0).toUpperCase()}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                            <div className="avatar-group-item">
                                                                                                <div className="avatar-xs">
                                                                                                    <div className="avatar-title rounded-circle bg-light text-primary">
                                                                                                        +
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </CardBody>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    </SimpleBar>
                                </div>
                                <div className="my-2 mt-0">
                                    <Button color="soft-info" className="w-100" onClick={() => setModalOpen(true)}>
                                        <i className="ri-add-line align-bottom me-1"></i> Nueva Tarea
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </DragDropContext>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={modalOpen} toggle={() => setModalOpen(!modalOpen)}>
                <ModalHeader toggle={() => setModalOpen(!modalOpen)}>Nueva Tarea</ModalHeader>
                <ModalBody>
                    <Form onSubmit={handleCreateTask}>
                        <FormGroup>
                            <Label>Título</Label>
                            <Input required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </FormGroup>
                        <FormGroup>
                            <Label>Descripción</Label>
                            <Input type="textarea" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </FormGroup>
                        <FormGroup>
                            <Label>Prioridad</Label>
                            <Input type="select" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}>
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                            </Input>
                        </FormGroup>

                        {isSuperAdmin && !effectiveAssigneeId && (
                            <FormGroup>
                                <Label>Asignar a</Label>
                                <Input type="select" value={targetAssignee} onChange={e => setTargetAssignee(e.target.value)}>
                                    <option value="">-- Seleccionar Empleado --</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                                    ))}
                                </Input>
                            </FormGroup>
                        )}
                        {!isSuperAdmin && !effectiveAssigneeId && (
                            <p className="text-muted fs-12">Se asignará a ti automáticamente.</p>
                        )}

                        <div className="text-end">
                            <Button type="submit" color="primary">Crear Tarea</Button>
                        </div>
                    </Form>
                </ModalBody>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={editModalOpen} toggle={() => setEditModalOpen(!editModalOpen)}>
                <ModalHeader toggle={() => setEditModalOpen(!editModalOpen)}>Detalles de la Tarea</ModalHeader>
                <ModalBody>
                    <Form onSubmit={handleUpdateTask}>
                        <FormGroup>
                            <Label>Título</Label>
                            <Input required value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </FormGroup>
                        <FormGroup>
                            <Label>Descripción</Label>
                            <Input type="textarea" value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={5} />
                        </FormGroup>
                        <Row>
                            <Col md={6}>
                                <FormGroup>
                                    <Label>Prioridad</Label>
                                    <Input type="select" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}>
                                        <option value="low">Baja</option>
                                        <option value="medium">Media</option>
                                        <option value="high">Alta</option>
                                    </Input>
                                </FormGroup>
                            </Col>
                            <Col md={6}>
                                <FormGroup>
                                    <Label>Estado</Label>
                                    <Input type="select" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        {columns.map(c => <option key={c.id} value={c.status_key}>{c.title}</option>)}
                                    </Input>
                                </FormGroup>
                            </Col>
                        </Row>

                        <div className="d-flex justify-content-between mt-4">
                            <Button type="button" color="danger" outline onClick={handleDeleteTask}>Eliminar Tarea</Button>
                            <Button type="submit" color="primary">Guardar Cambios</Button>
                        </div>
                    </Form>
                </ModalBody>
            </Modal>
        </React.Fragment>
    );
};

export default EmployeeKanban;
