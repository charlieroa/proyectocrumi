import React, { useState, useEffect, useCallback } from "react"
import {
  Card,
  CardBody,
  Col,
  Row,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
  Modal,
  ModalBody,
  ModalHeader,
  Form,
  Label,
  Input,
  FormFeedback,
  Badge,
} from "reactstrap"
import { useFormik } from "formik"
import * as Yup from "yup"
import Select from "react-select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
// SimpleBar removed - interferes with drag & drop between columns
import { ToastContainer, toast } from "react-toastify"
import Spinners from "Components/Common/Spinner"
import DeleteModal from "Components/Common/DeleteModal";
import Flatpickr from "react-flatpickr";
import moment from "moment";
import { getTasks, createTask, updateTask, deleteTask, getUsersForAssignment, toggleChecklistItem, addChecklistItem, deleteChecklistItem, Task, UserForAssignment, Assignee, ChecklistItem } from "../../../services/taskService";
import { getDecodedToken } from "../../../services/auth";
import { api } from "../../../services/api";

interface KanbanColumn {
  id: string;
  name: string;
  badge?: number;
  color?: string;
  cards: Task[];
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'pending', name: 'Pendiente', color: 'warning', cards: [] },
  { id: 'in_progress', name: 'En Progreso', color: 'info', cards: [] },
  { id: 'done', name: 'Completado', color: 'success', cards: [] },
];

const TasksKanban = () => {
  const [isLoading, setLoading] = useState<boolean>(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserForAssignment[]>([]);
  const [cards, setCards] = useState<KanbanColumn[]>([]);
  const [modal, setModal] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [deleteModal, setDeleteModal] = useState<boolean>(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isEmployee, setIsEmployee] = useState<boolean>(false);
  
  // Checklist state
  const [checklistItems, setChecklistItems] = useState<{text: string; completed: boolean}[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState<string>('');

  // Estados para filtrar por Empresa (Super Admin)
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

  const organizeTasksIntoColumns = useCallback((tasksList: Task[]) => {
    const list = Array.isArray(tasksList) ? tasksList : [];
    const organized: KanbanColumn[] = KANBAN_COLUMNS.map(col => ({
      ...col,
      cards: list.filter((task: Task) => task && task.status === col.id)
    }));
    setCards(organized);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, usersData] = await Promise.all([
        getTasks(),
        getUsersForAssignment()
      ]);
      const taskList = Array.isArray(tasksData) ? tasksData : [];
      const userList = Array.isArray(usersData) ? usersData : [];
      setTasks(taskList);
      setUsers(userList);
      organizeTasksIntoColumns(taskList);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar las tareas');
      setTasks([]);
      setUsers([]);
      organizeTasksIntoColumns([]);
    } finally {
      setLoading(false);
    }
  }, [organizeTasksIntoColumns]);

  const loadTenants = useCallback(async () => {
    try {
      const { data } = await api.get('/tenants');
      setTenants(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading tenants", e);
    }
  }, []);

  // Cargar tareas y usuarios, y detectar rol
  useEffect(() => {
    // Detectar si es empleado o super admin (role_id puede venir como número o string del JWT)
    const decodedToken = getDecodedToken();
    const roleId = Number(decodedToken?.user?.role_id);
    if (roleId === 3) {
      setIsEmployee(true);
    }
    if (roleId === 99) {
      setIsSuperAdmin(true);
      loadTenants();
    }
    loadData();
  }, [loadData, loadTenants]);

  // Drag and drop
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const taskId = draggableId;
    const newStatus = destination.droppableId as 'pending' | 'in_progress' | 'done';

    // Si se mueve a la misma columna, solo reordenar
    if (source.droppableId === destination.droppableId) {
      const column = cards.find(col => col.id === source.droppableId);
      if (!column) return;

      const reorderedCards = Array.from(column.cards);
      const [movedCard] = reorderedCards.splice(source.index, 1);
      reorderedCards.splice(destination.index, 0, movedCard);

      const updatedCards = cards.map(col =>
        col.id === source.droppableId ? { ...col, cards: reorderedCards } : col
      );
      setCards(updatedCards);
      return;
    }

    // Si se mueve a otra columna, actualizar estado en backend
    try {
      await updateTask(taskId, { status: newStatus });

      // Actualizar estado local
      const updatedTasks = tasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      );
      setTasks(updatedTasks);
      organizeTasksIntoColumns(updatedTasks);

      toast.success('Tarea actualizada');
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast.error('Error al actualizar la tarea');
      loadData(); // Recargar en caso de error
    }
  };

  // Modal de crear/editar tarea
  const toggle = () => {
    if (modal) {
      setModal(false);
      setSelectedTask(null);
      setIsEdit(false);
      setSelectedStatus('pending');
      setChecklistItems([]);
      setNewChecklistItem('');
    } else {
      setModal(true);
    }
  };

  const handleAddNewCard = (status: string) => {
    setSelectedTask(null);
    setIsEdit(false);
    setSelectedStatus(status);
    toggle();
  };

  const handleCardEdit = (task: Task) => {
    setSelectedTask(task);
    setIsEdit(true);
    setSelectedStatus(task.status);
    // Cargar checklist existente
    if (task.checklist && Array.isArray(task.checklist)) {
      setChecklistItems(task.checklist.map(item => ({ text: item.text, completed: item.completed })));
    } else {
      setChecklistItems([]);
    }
    toggle();
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteModal(true);
  };

  const handleDeleteCard = async () => {
    if (!taskToDelete) return;

    try {
      await deleteTask(taskToDelete.id);
      toast.success('Tarea eliminada');
      setDeleteModal(false);
      setTaskToDelete(null);
      loadData();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast.error('Error al eliminar la tarea');
    }
  };



  // Opciones de usuarios para el select múltiple
  const userOptions = users.map(user => ({
    value: user.id,
    label: `${user.first_name} ${user.last_name}${user.tenant_name ? ` (${user.tenant_name})` : ''}`,
    email: user.email,
    tenant_name: user.tenant_name,
  }));

  // Opciones de prioridad
  const priorityOptions = [
    { value: 'low', label: 'Baja', color: 'success' },
    { value: 'medium', label: 'Media', color: 'warning' },
    { value: 'high', label: 'Alta', color: 'danger' },
  ];

  // Función para obtener iniciales del nombre
  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Función para obtener color de prioridad
  const getPriorityColor = (priority?: string) => {
    const option = priorityOptions.find(opt => opt.value === priority);
    return option?.color || 'secondary';
  };

  // Obtener IDs de asignados de la tarea seleccionada
  const getInitialAssignees = (): string[] => {
    if (!selectedTask) return [];
    if (selectedTask.assignees && Array.isArray(selectedTask.assignees)) {
      return selectedTask.assignees.map((a: Assignee) => a.id);
    }
    if (selectedTask.assigned_to) return [selectedTask.assigned_to];
    return [];
  };

  const validation = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: (selectedTask && selectedTask.title) || '',
      description: (selectedTask && selectedTask.description) || '',
      assignees: getInitialAssignees(),
      priority: (selectedTask && selectedTask.priority) || 'medium',
      due_date: (selectedTask && selectedTask.due_date) ? moment(selectedTask.due_date).format('YYYY-MM-DD') : '',
      status: (selectedTask && selectedTask.status) || selectedStatus || 'pending',
      task_tenant_id: selectedTenantId || ''
    },
    validationSchema: Yup.object({
      title: Yup.string().required("Por favor ingresa un título"),
      assignees: isSuperAdmin
        ? Yup.array()
        : Yup.array().min(1, "Por favor asigna la tarea a al menos un usuario"),
      status: Yup.string().oneOf(['pending', 'in_progress', 'done']),
    }),
    onSubmit: async (values) => {
      try {
        const payload = {
          title: values.title,
          description: values.description || undefined,
          assignees: values.assignees,
          priority: values.priority as "low" | "medium" | "high",
          due_date: values.due_date || undefined,
          status: values.status as "pending" | "in_progress" | "done" | undefined,
          task_tenant_id: selectedTenantId || undefined,
          checklist: checklistItems.filter(item => item.text.trim())
        };

        if (isEdit && selectedTask) {
          await updateTask(selectedTask.id, payload);
          toast.success("Tarea actualizada correctamente");
        } else {
          await createTask(payload);
          toast.success("Tarea creada correctamente");
        }
        toggle();
        loadData();
      } catch (error: any) {
        toast.error(error?.response?.data?.error || "Error al guardar la tarea");
      }
    },
  });

  // Funciones para checklist
  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, { text: newChecklistItem.trim(), completed: false }]);
      setNewChecklistItem('');
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleToggleChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.map((item, i) => 
      i === index ? { ...item, completed: !item.completed } : item
    ));
  };

  // Toggle checklist en tarjeta (sin abrir modal)
  const handleToggleCardChecklistItem = async (taskId: string, itemId: string) => {
    try {
      await toggleChecklistItem(itemId);
      loadData();
    } catch (error) {
      toast.error("Error al actualizar el checklist");
    }
  };

  return (
    <React.Fragment>
      <DeleteModal
        show={deleteModal}
        onDeleteClick={handleDeleteCard}
        onCloseClick={() => {
          setDeleteModal(false);
          setTaskToDelete(null);
        }}
      />

      <Card>
        <CardBody>
          <Row className="g-2">
            <div className="col-lg-auto">
              <div className="hstack gap-2">
                {!isEmployee && (
                  <button className="btn btn-primary" onClick={() => handleAddNewCard('pending')}>
                    <i className="ri-add-line align-bottom me-1"></i> Crear Tarea
                  </button>
                )}
              </div>
            </div>
            <div className="col-lg-3 col-auto">
              <div className="search-box">
                <input
                  type="text"
                  className="form-control search"
                  placeholder="Buscar tareas..."
                />
                <i className="ri-search-line search-icon"></i>
              </div>
            </div>
          </Row>
        </CardBody>
      </Card>

      <div className="tasks-board mb-3 d-flex" id="kanbanboard">
        {isLoading ? (
          <Spinners setLoading={setLoading} />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            {cards.map((line: KanbanColumn) => (
              <div className="tasks-list" key={line.id}>
                <div className="d-flex mb-3">
                  <div className="flex-grow-1">
                    <h6 className="fs-14 text-uppercase fw-semibold mb-0">
                      {line.name}{' '}
                      <small className={`badge bg-${line.color} align-bottom ms-1 totaltask-badge`}>
                        {line.badge || line.cards.length}
                      </small>
                    </h6>
                  </div>
                </div>
                <Droppable droppableId={line.id}>
                  {(provided: any, snapshot: any) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="tasks-wrapper px-3 mx-n3"
                      style={{
                        overflowY: 'auto',
                        minHeight: '200px',
                        background: snapshot.isDraggingOver ? 'rgba(var(--bs-primary-rgb), 0.04)' : 'transparent',
                        borderRadius: '6px',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {line.cards.length === 0 ? (
                        <div className="text-center py-5">
                          <p className="text-muted mb-0">Vacío</p>
                        </div>
                      ) : (
                        line.cards.map((card: Task, index: number) => {
                          // Obtener asignados: preferir assignees[], fallback a assigned_to
                          const cardAssignees: Assignee[] = card.assignees && Array.isArray(card.assignees)
                            ? card.assignees
                            : (card.assigned_to ? [users.find(u => u.id === card.assigned_to) as any].filter(Boolean) : []);

                          return (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided: any, snapshot: any) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="pb-1 task-list"
                                  style={{
                                    ...provided.draggableProps.style,
                                    opacity: snapshot.isDragging ? 0.85 : 1,
                                    cursor: 'grab',
                                  }}
                                >
                                  <div className="card task-box" style={{ boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined }}>
                                    <CardBody>
                                      <div className="d-flex justify-content-between align-items-start mb-2">
                                        <Badge color={getPriorityColor(card.priority)} className="me-2">
                                          {priorityOptions.find(opt => opt.value === card.priority)?.label || 'Media'}
                                        </Badge>
                                        {!isEmployee && (
                                          <UncontrolledDropdown className="float-end">
                                            <DropdownToggle className="arrow-none" tag="a" color="white">
                                              <i className="ri-more-fill"></i>
                                            </DropdownToggle>
                                            <DropdownMenu className="dropdown-menu-end">
                                              <DropdownItem onClick={() => handleCardEdit(card)}>
                                                Editar
                                              </DropdownItem>
                                              <DropdownItem onClick={() => handleDeleteClick(card)}>
                                                Eliminar
                                              </DropdownItem>
                                            </DropdownMenu>
                                          </UncontrolledDropdown>
                                        )}
                                      </div>
                                      <div className="mb-2">
                                        <h6 className="fs-15 mb-0 flex-grow-1 text-truncate task-title">
                                          {card.title}
                                        </h6>
                                      </div>
                                      {/* Checklist progress */}
                                      {card.checklist && card.checklist.length > 0 && (
                                        <div className="mb-2">
                                          <div className="d-flex align-items-center gap-2 mb-1">
                                            <i className="ri-checkbox-multiple-line text-primary"></i>
                                            <small className="text-muted">
                                              {card.checklist.filter(i => i.completed).length}/{card.checklist.length} completadas
                                            </small>
                                          </div>
                                          <div className="progress" style={{ height: '4px' }}>
                                            <div
                                              className="progress-bar bg-success"
                                              style={{ width: `${(card.checklist.filter(i => i.completed).length / card.checklist.length) * 100}%` }}
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {card.due_date && (
                                        <div className="mb-2">
                                          <small className="text-muted">
                                            <i className="ri-time-line align-bottom me-1"></i>
                                            {moment(card.due_date).format('DD MMM, YYYY')}
                                          </small>
                                        </div>
                                      )}
                                      {/* Mostrar múltiples asignados */}
                                      <div className="d-flex align-items-center justify-content-between">
                                        {cardAssignees.length > 0 && (
                                          <div className="avatar-group" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {cardAssignees.slice(0, 3).map((assignee: Assignee, idx: number) => (
                                              <div
                                                key={assignee.id || idx}
                                                className="avatar-xs rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
                                                style={{ marginLeft: idx > 0 ? '-8px' : '0', border: '2px solid white', fontSize: '10px' }}
                                                title={`${assignee.first_name} ${assignee.last_name}`}
                                              >
                                                {getInitials(assignee.first_name, assignee.last_name)}
                                              </div>
                                            ))}
                                            {cardAssignees.length > 3 && (
                                              <div
                                                className="avatar-xs rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center"
                                                style={{ marginLeft: '-8px', border: '2px solid white', fontSize: '10px' }}
                                              >
                                                +{cardAssignees.length - 3}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {cardAssignees.length > 0 && (
                                          <small className="text-muted" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {cardAssignees.length === 1
                                              ? `${cardAssignees[0].first_name} ${cardAssignees[0].last_name}`
                                              : `${cardAssignees.length} personas`
                                            }
                                          </small>
                                        )}
                                      </div>
                                    </CardBody>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                {!isEmployee && (
                  <div className="my-2 mt-0">
                    <button
                      className="btn btn-soft-info w-100"
                      onClick={() => handleAddNewCard(line.id)}
                    >
                      Agregar Tarea
                    </button>
                  </div>
                )}
              </div>
            ))}
          </DragDropContext>
        )}
      </div>

      {/* Modal de crear/editar tarea */}
      <Modal isOpen={modal} toggle={toggle} centered={true} size="lg">
        <ModalHeader toggle={toggle}>
          {isEdit ? "Editar Tarea" : "Crear Nueva Tarea"}
        </ModalHeader>
        <ModalBody>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              validation.handleSubmit();
              return false;
            }}
          >
            <div className="form-group mb-3">
              <Label htmlFor="taskname" className="col-form-label">
                Título de la Tarea<span className="text-danger">*</span>
              </Label>
              <Col lg={12}>
                <Input
                  id="taskname"
                  name="title"
                  type="text"
                  className="form-control"
                  placeholder="Ingresa el título de la tarea..."
                  onChange={validation.handleChange}
                  onBlur={validation.handleBlur}
                  value={validation.values.title || ""}
                  invalid={validation.touched.title && !!validation.errors.title}
                />
                {validation.touched.title && validation.errors.title && (
                  <FormFeedback type="invalid">
                    {validation.errors.title}
                  </FormFeedback>
                )}
              </Col>
            </div>

            {/* Checklist de Actividades */}
            <div className="form-group mb-3">
              <Label className="col-form-label">
                <i className="ri-checkbox-multiple-line me-1"></i>
                Checklist de Actividades
              </Label>
              <Col lg={12}>
                {/* Lista de items */}
                {checklistItems.length > 0 && (
                  <div className="mb-2">
                    {checklistItems.map((item, index) => (
                      <div key={index} className="d-flex align-items-center mb-1 p-2 bg-light rounded">
                        <Input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => handleToggleChecklistItem(index)}
                          className="me-2"
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span className={item.completed ? 'text-decoration-line-through text-muted flex-grow-1' : 'flex-grow-1'}>
                          {item.text}
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-soft-danger"
                          onClick={() => handleRemoveChecklistItem(index)}
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Input para agregar nuevo item */}
                <div className="d-flex gap-2">
                  <Input
                    type="text"
                    placeholder="Agregar actividad..."
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-soft-primary"
                    onClick={handleAddChecklistItem}
                    disabled={!newChecklistItem.trim()}
                  >
                    <i className="ri-add-line"></i>
                  </button>
                </div>
                <small className="text-muted">Presiona Enter o el botón + para agregar</small>
              </Col>
            </div>

            {isSuperAdmin && (
              <div className="form-group mb-3">
                <Label className="col-form-label">Filtrar por Empresa (Opcional)</Label>
                <Col lg={12}>
                  <Select
                    options={tenants.map(t => ({ value: t.id, label: t.name }))}
                    onChange={(option: any) => {
                      setSelectedTenantId(option?.value || null);
                      validation.setFieldValue('assigned_to', '');
                    }}
                    placeholder="Todas las empresas..."
                    isClearable
                    className="mb-0"
                  />
                </Col>
              </div>
            )}

            <div className="form-group mb-3">
              <Label className="col-form-label">
                Asignar a<span className="text-danger">*</span> <small className="text-muted">(puedes seleccionar varias personas)</small>
              </Label>
              <Col lg={12}>
                <Select
                  isMulti
                  value={userOptions.filter(opt => validation.values.assignees.includes(opt.value))}
                  onChange={(options: any) => {
                    const selectedIds = options ? options.map((opt: any) => opt.value) : [];
                    validation.setFieldValue('assignees', selectedIds);
                  }}
                  options={userOptions}
                  placeholder="Selecciona usuarios..."
                  className="mb-0"
                  closeMenuOnSelect={false}
                  styles={{
                    multiValue: (base: any) => ({
                      ...base,
                      backgroundColor: '#667eea20',
                      borderRadius: '4px',
                    }),
                    multiValueLabel: (base: any) => ({
                      ...base,
                      color: '#667eea',
                    }),
                  }}
                />
                {validation.touched.assignees && validation.errors.assignees && (
                  <FormFeedback type="invalid" className="d-block">
                    {validation.errors.assignees as string}
                  </FormFeedback>
                )}
              </Col>
            </div>

            <div className="form-group mb-3">
              <Label className="col-form-label">Prioridad</Label>
              <Col lg={12}>
                <Select
                  value={priorityOptions.find(opt => opt.value === validation.values.priority) || null}
                  onChange={(option: any) => {
                    validation.setFieldValue('priority', option?.value || 'medium');
                  }}
                  options={priorityOptions}
                  placeholder="Selecciona la prioridad..."
                  className="mb-0"
                />
              </Col>
            </div>

            <div className="form-group mb-3">
              <Label htmlFor="date-field" className="form-label">
                Fecha de Vencimiento
              </Label>
              <Flatpickr
                name="due_date"
                className="form-control"
                id="datepicker-publish-input"
                placeholder="Selecciona una fecha"
                options={{
                  altInput: true,
                  altFormat: "d M, Y",
                  dateFormat: "Y-m-d",
                }}
                onChange={(dates: any) => {
                  if (dates && dates[0]) {
                    validation.setFieldValue("due_date", moment(dates[0]).format('YYYY-MM-DD'));
                  }
                }}
                value={validation.values.due_date || ''}
              />
            </div>

            {!isEdit && (
              <div className="form-group mb-4">
                <Label className="col-form-label">Estado</Label>
                <Col lg={12}>
                  <Select
                    value={KANBAN_COLUMNS.find(col => col.id === validation.values.status) ?
                      { value: validation.values.status, label: KANBAN_COLUMNS.find(col => col.id === validation.values.status)?.name } : null
                    }
                    onChange={(option: any) => {
                      validation.setFieldValue('status', option?.value || 'pending');
                    }}
                    options={KANBAN_COLUMNS.map(col => ({ value: col.id, label: col.name }))}
                    placeholder="Selecciona el estado..."
                    className="mb-0"
                  />
                </Col>
              </div>
            )}

            <Row>
              <Col lg={12}>
                <div className="hstack gap-2 justify-content-end">
                  <button type="button" className="btn btn-light" onClick={toggle}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {isEdit ? "Actualizar Tarea" : "Crear Tarea"}
                  </button>
                </div>
              </Col>
            </Row>
          </Form>
        </ModalBody>
      </Modal>

      <ToastContainer />
    </React.Fragment>
  )
}

export default TasksKanban
