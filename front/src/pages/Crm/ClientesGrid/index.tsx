// src/pages/Crm/ClientesGrid/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Button,
    Card,
    CardBody,
    Col,
    Container,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownToggle,
    Form,
    Input,
    Label,
    Modal,
    ModalBody,
    ModalHeader,
    ModalFooter,
    Row,
    UncontrolledDropdown,
    FormFeedback,
    Spinner,
    InputGroup,
} from 'reactstrap';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import { ToastContainer } from 'react-toastify';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Images
import dummyImg from '../../../assets/images/users/user-dummy-img.jpg';
import smallImage9 from '../../../assets/images/small/img-9.jpg';
import smallImage4 from '../../../assets/images/small/img-4.jpg';
import smallImage5 from '../../../assets/images/small/img-5.jpg';
import smallImage6 from '../../../assets/images/small/img-6.jpg';

// Redux
import { useSelector, useDispatch } from 'react-redux';
import { createSelector } from 'reselect';

// Thunks
import {
    getContacts,
    addNewContact,
    updateContact,
    deleteContact,
} from '../../../slices/crm/thunk';

// Formik
import * as Yup from 'yup';
import { useFormik } from 'formik';
import { unwrapResult } from '@reduxjs/toolkit';

// Background images para las tarjetas
const backgroundImages = [smallImage9, smallImage4, smallImage5, smallImage6];

const ClientesGrid: React.FC = () => {
    document.title = 'Clientes | Velzon';

    const dispatch: any = useDispatch();
    const navigate = useNavigate();

    // Redux selector
    const selectCrmState = createSelector(
        (state: any) => state.Crm,
        (crm) => ({
            clients: crm.crmcontacts || [],
            loading: crm.loading || false,
            error: crm.error,
        })
    );
    const { clients, loading } = useSelector(selectCrmState);

    // Estados
    const [clientList, setClientList] = useState<any>([]);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [contactToEdit, setContactToEdit] = useState<any>(null);
    const [modal, setModal] = useState<boolean>(false);
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

    // Cargar clientes
    useEffect(() => {
        dispatch(getContacts());
    }, [dispatch]);

    useEffect(() => {
        // Agregar imagen de fondo aleatoria a cada cliente
        const enrichedClients = (clients || []).map((client: any, index: number) => ({
            ...client,
            backgroundImg: client.backgroundImg || backgroundImages[index % backgroundImages.length],
            documentCount: client.documentCount || Math.floor(Math.random() * 15), // TODO: obtener del backend
            invoiceCount: client.invoiceCount || Math.floor(Math.random() * 10),
        }));
        setClientList(enrichedClients);
    }, [clients]);

    // Toggle modal
    const toggle = useCallback(() => {
        if (modal) {
            setModal(false);
            setContactToEdit(null);
            setShowPassword(false);
        } else {
            setModal(true);
        }
    }, [modal]);

    // Abrir modal para agregar cliente
    const handleAddClientClick = () => {
        setIsEdit(false);
        setContactToEdit(null);
        validation.resetForm();
        toggle();
    };

    // Abrir modal para editar cliente
    const handleEditClick = useCallback((clientData: any) => {
        setIsEdit(true);
        const nameParts = (clientData.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ');

        setContactToEdit({
            id: clientData.id,
            first_name: firstName,
            last_name: lastName,
            email: clientData.email,
            phone: clientData.phone,
        });
        toggle();
    }, [toggle]);

    // Eliminar cliente con SweetAlert
    const onClickDelete = (clientData: any) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: `Estás a punto de eliminar a ${clientData.name}. ¡No podrás revertir esto!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, ¡eliminar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                handleDeleteContact(clientData.id);
            }
        });
    };

    const handleDeleteContact = async (contactId: string) => {
        try {
            const resultAction = await dispatch(deleteContact(contactId));
            unwrapResult(resultAction);
            Swal.fire('¡Eliminado!', 'El cliente ha sido eliminado con éxito.', 'success');
        } catch (err) {
            Swal.fire('Error', 'Ocurrió un error al eliminar el cliente.', 'error');
        }
    };

    // Navegar al Kanban del cliente
    const handleClientClick = (client: any) => {
        navigate(`/clientes/${client.id}/documentos`);
    };

    // Búsqueda
    const searchList = (inputVal: string) => {
        const filterData = (clients || []).filter((client: any) =>
            (client.name || '').toLowerCase().includes(inputVal.toLowerCase()) ||
            (client.email || '').toLowerCase().includes(inputVal.toLowerCase())
        );

        const enrichedFiltered = filterData.map((client: any, index: number) => ({
            ...client,
            backgroundImg: client.backgroundImg || backgroundImages[index % backgroundImages.length],
            documentCount: client.documentCount || Math.floor(Math.random() * 15),
            invoiceCount: client.invoiceCount || Math.floor(Math.random() * 10),
        }));

        setClientList(enrichedFiltered);
    };

    // Favoritos
    const favouriteBtn = (ele: any) => {
        if (ele.closest('button').classList.contains('active')) {
            ele.closest('button').classList.remove('active');
        } else {
            ele.closest('button').classList.add('active');
        }
    };

    // Formik
    const validation = useFormik({
        enableReinitialize: true,
        initialValues: {
            first_name: (contactToEdit && contactToEdit.first_name) || '',
            last_name: (contactToEdit && contactToEdit.last_name) || '',
            email: (contactToEdit && contactToEdit.email) || '',
            phone: (contactToEdit && contactToEdit.phone) || '',
            password: '',
        },
        validationSchema: Yup.object({
            first_name: Yup.string().required('El nombre es obligatorio'),
            email: Yup.string().email('Debe ser un email válido').required('El email es obligatorio'),
            phone: Yup.string().optional(),
            password: Yup.string().when([], {
                is: () => !isEdit,
                then: (schema) => schema.min(6, 'La contraseña debe tener al menos 6 caracteres').required('La contraseña es obligatoria'),
                otherwise: (schema) => schema.optional(),
            }),
        }),
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            const clientData = {
                first_name: values.first_name,
                last_name: values.last_name,
                email: values.email,
                phone: values.phone,
                ...(values.password && !isEdit && { password: values.password }),
            };

            try {
                if (isEdit) {
                    const resultAction = await dispatch(updateContact({ id: contactToEdit.id, ...clientData }));
                    unwrapResult(resultAction);
                    Swal.fire({ title: '¡Éxito!', text: 'Cliente actualizado con éxito.', icon: 'success' });
                } else {
                    const resultAction = await dispatch(addNewContact(clientData));
                    unwrapResult(resultAction);
                    Swal.fire({ title: '¡Éxito!', text: 'Cliente creado con éxito.', icon: 'success' });
                }
                resetForm();
                toggle();
            } catch (err: any) {
                Swal.fire({ title: 'Error', text: err.error || 'Ocurrió un error', icon: 'error' });
            } finally {
                setSubmitting(false);
            }
        },
    });

    return (
        <React.Fragment>
            <ToastContainer closeButton={false} />
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Clientes" pageTitle="CRM" />

                    {/* Barra de búsqueda y acciones */}
                    <Card>
                        <CardBody>
                            <Row className="g-2">
                                <Col sm={4}>
                                    <div className="search-box">
                                        <Input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar cliente por nombre o email..."
                                            onChange={(e) => searchList(e.target.value)}
                                        />
                                        <i className="ri-search-line search-icon"></i>
                                    </div>
                                </Col>
                                <Col className="col-sm-auto ms-auto">
                                    <div className="list-grid-nav hstack gap-1">
                                        <Button color="info" className="btn btn-soft-info nav-link btn-icon fs-14 active">
                                            <i className="ri-grid-fill"></i>
                                        </Button>
                                        <Dropdown isOpen={dropdownOpen} toggle={() => setDropdownOpen(!dropdownOpen)}>
                                            <DropdownToggle className="btn btn-soft-info btn-icon fs-14" tag="button">
                                                <i className="ri-more-2-fill"></i>
                                            </DropdownToggle>
                                            <DropdownMenu>
                                                <DropdownItem>Todos</DropdownItem>
                                                <DropdownItem>Con facturas pendientes</DropdownItem>
                                                <DropdownItem>Activos este mes</DropdownItem>
                                            </DropdownMenu>
                                        </Dropdown>
                                        <Button color="success" onClick={handleAddClientClick}>
                                            <i className="ri-add-fill me-1 align-bottom"></i> Agregar Cliente
                                        </Button>
                                    </div>
                                </Col>
                            </Row>
                        </CardBody>
                    </Card>

                    {/* Grid de Clientes */}
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner color="primary" />
                            <p className="mt-2">Cargando clientes...</p>
                        </div>
                    ) : (
                        <Row>
                            <Col lg={12}>
                                <div id="clientlist">
                                    <Row className="team-list grid-view-filter">
                                        {(clientList || []).map((client: any, key: number) => (
                                            <Col xxl={3} xl={4} sm={6} key={key}>
                                                <Card className="team-box">
                                                    <div className="team-cover">
                                                        <img src={client.backgroundImg} alt="" className="img-fluid" />
                                                    </div>
                                                    <CardBody className="p-4">
                                                        <Row className="align-items-center team-row">
                                                            <Col className="team-settings">
                                                                <Row>
                                                                    <Col>
                                                                        <div className="flex-shrink-0 me-2">
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-light btn-icon rounded-circle btn-sm favourite-btn"
                                                                                onClick={(e) => favouriteBtn(e.target)}
                                                                            >
                                                                                <i className="ri-star-fill fs-14"></i>
                                                                            </button>
                                                                        </div>
                                                                    </Col>
                                                                    <UncontrolledDropdown direction="start" className="col text-end">
                                                                        <DropdownToggle tag="a" role="button">
                                                                            <i className="ri-more-fill fs-17"></i>
                                                                        </DropdownToggle>
                                                                        <DropdownMenu>
                                                                            <DropdownItem onClick={() => handleClientClick(client)}>
                                                                                <i className="ri-folder-open-line me-2 align-bottom text-muted"></i>
                                                                                Ver Documentos
                                                                            </DropdownItem>
                                                                            <DropdownItem onClick={() => handleEditClick(client)}>
                                                                                <i className="ri-pencil-line me-2 align-bottom text-muted"></i>
                                                                                Editar
                                                                            </DropdownItem>
                                                                            <DropdownItem onClick={() => onClickDelete(client)}>
                                                                                <i className="ri-delete-bin-5-line me-2 align-bottom text-muted"></i>
                                                                                Eliminar
                                                                            </DropdownItem>
                                                                        </DropdownMenu>
                                                                    </UncontrolledDropdown>
                                                                </Row>
                                                            </Col>
                                                            <Col lg={12} className="col">
                                                                <div className="team-profile-img text-center">
                                                                    <div
                                                                        className="avatar-lg img-thumbnail rounded-circle flex-shrink-0 mx-auto"
                                                                        style={{ cursor: 'pointer' }}
                                                                        onClick={() => handleClientClick(client)}
                                                                    >
                                                                        {client.img ? (
                                                                            <img
                                                                                src={client.img}
                                                                                alt=""
                                                                                className="img-fluid d-block rounded-circle"
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                            />
                                                                        ) : (
                                                                            <div className="avatar-title text-uppercase border rounded-circle bg-light text-primary fs-24">
                                                                                {(client.name || 'NN').charAt(0)}
                                                                                {(client.name || 'NN').split(' ').slice(-1).toString().charAt(0)}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="team-content mt-3">
                                                                        <Link
                                                                            to={`/clientes/${client.id}/documentos`}
                                                                            className="text-body"
                                                                        >
                                                                            <h5 className="fs-16 mb-1">{client.name}</h5>
                                                                        </Link>
                                                                        <p className="text-muted mb-0">{client.email}</p>
                                                                    </div>
                                                                </div>
                                                            </Col>
                                                            <Col lg={12} className="col mt-3">
                                                                <Row className="text-muted text-center">
                                                                    <Col xs={6} className="border-end border-end-dashed">
                                                                        <h5 className="mb-1">{client.documentCount || 0}</h5>
                                                                        <p className="text-muted mb-0">Documentos</p>
                                                                    </Col>
                                                                    <Col xs={6}>
                                                                        <h5 className="mb-1">{client.invoiceCount || 0}</h5>
                                                                        <p className="text-muted mb-0">Facturas</p>
                                                                    </Col>
                                                                </Row>
                                                            </Col>
                                                            <Col lg={12} className="col mt-3">
                                                                <div className="text-center">
                                                                    <Button
                                                                        color="primary"
                                                                        size="sm"
                                                                        className="view-btn"
                                                                        onClick={() => handleClientClick(client)}
                                                                    >
                                                                        <i className="ri-folder-open-line me-1"></i>
                                                                        Ver Documentos
                                                                    </Button>
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                    </CardBody>
                                                </Card>
                                            </Col>
                                        ))}
                                    </Row>

                                    {clientList.length === 0 && !loading && (
                                        <div className="py-4 mt-4 text-center">
                                            <i className="ri-search-line display-5 text-success"></i>
                                            <h5 className="mt-4">No se encontraron clientes</h5>
                                            <p className="text-muted">Intenta con otros términos de búsqueda o agrega un nuevo cliente.</p>
                                        </div>
                                    )}
                                </div>
                            </Col>
                        </Row>
                    )}
                </Container>
            </div>

            {/* Modal Agregar/Editar Cliente */}
            <Modal id="showModal" isOpen={modal} toggle={toggle} centered>
                <ModalHeader className="bg-primary-subtle p-3" toggle={toggle}>
                    {isEdit
                        ? `Editar Cliente: ${contactToEdit?.first_name || ''} ${contactToEdit?.last_name || ''}`.trim()
                        : 'Agregar Cliente'}
                </ModalHeader>
                <Form onSubmit={validation.handleSubmit}>
                    <ModalBody>
                        <Row className="g-3">
                            <Col md={6}>
                                <Label htmlFor="first_name-field">Nombre</Label>
                                <Input
                                    name="first_name"
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    value={validation.values.first_name}
                                    invalid={!!(validation.touched.first_name && validation.errors.first_name)}
                                />
                                {validation.touched.first_name && validation.errors.first_name && (
                                    <FormFeedback>{validation.errors.first_name as string}</FormFeedback>
                                )}
                            </Col>
                            <Col md={6}>
                                <Label htmlFor="last_name-field">Apellido</Label>
                                <Input
                                    name="last_name"
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    value={validation.values.last_name}
                                />
                            </Col>
                            <Col md={12}>
                                <Label htmlFor="email-field">Email</Label>
                                <Input
                                    name="email"
                                    type="email"
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    value={validation.values.email}
                                    invalid={!!(validation.touched.email && validation.errors.email)}
                                />
                                {validation.touched.email && validation.errors.email && (
                                    <FormFeedback>{validation.errors.email as string}</FormFeedback>
                                )}
                            </Col>
                            <Col md={12}>
                                <Label htmlFor="phone-field">Teléfono</Label>
                                <Input
                                    name="phone"
                                    onChange={validation.handleChange}
                                    onBlur={validation.handleBlur}
                                    value={validation.values.phone}
                                />
                            </Col>
                            {!isEdit && (
                                <Col md={12}>
                                    <Label htmlFor="password-field">Contraseña</Label>
                                    <InputGroup>
                                        <Input
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            onChange={validation.handleChange}
                                            onBlur={validation.handleBlur}
                                            value={validation.values.password}
                                            invalid={!!(validation.touched.password && validation.errors.password)}
                                        />
                                        <button
                                            className="btn btn-light"
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <i className={showPassword ? 'ri-eye-off-fill' : 'ri-eye-fill'}></i>
                                        </button>
                                        {validation.touched.password && validation.errors.password && (
                                            <FormFeedback>{validation.errors.password as string}</FormFeedback>
                                        )}
                                    </InputGroup>
                                </Col>
                            )}
                        </Row>
                    </ModalBody>
                    <ModalFooter>
                        <div className="hstack gap-2 justify-content-end">
                            <button type="button" className="btn btn-light" onClick={toggle}>
                                Cerrar
                            </button>
                            <button type="submit" className="btn btn-success" disabled={validation.isSubmitting}>
                                {validation.isSubmitting ? <Spinner size="sm" /> : isEdit ? 'Guardar Cambios' : 'Agregar Cliente'}
                            </button>
                        </div>
                    </ModalFooter>
                </Form>
            </Modal>
        </React.Fragment>
    );
};

export default ClientesGrid;
