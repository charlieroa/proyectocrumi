import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Col,
  Container,
  Row,
  Card,
  CardHeader,
  CardBody,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  Label,
  Input,
  Modal,
  ModalHeader,
  ModalBody,
  Form,
  ModalFooter,
  FormFeedback,
  Spinner,
  Table,
  InputGroup
} from "reactstrap";
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from "reselect";
import { useFormik } from "formik";
import * as Yup from "yup";
import Swal from 'sweetalert2'; // Importación de SweetAlert2

// Componentes comunes
import BreadCrumb from "../../Components/Common/BreadCrumb";
// Ya no necesitamos DeleteModal: import DeleteModal from "../../Components/Common/DeleteModal";
import TableContainer from "../../Components/Common/TableContainer";
import Loader from "../../Components/Common/Loader";
import 'sweetalert2/dist/sweetalert2.min.css'; // Estilos de SweetAlert2
import dummyImg from "../../assets/images/users/user-dummy-img.jpg";

// Thunks del CRM
import {
  getContacts,
  addNewContact,
  updateContact,
  deleteContact,
} from "../../slices/crm/thunk";

import { jwtDecode } from "jwt-decode";
import { api } from "../../services/api";
import { getToken } from "../../services/auth";

// Componente Principal
const CrmContacts = () => {
  const dispatch: any = useDispatch();

  // Selector de Redux (Clientes normales)
  const selectCrmState = createSelector(
    (state: any) => state.Crm,
    (crm) => ({
      clients: crm.crmcontacts || [],
      loading: crm.loading || false,
      error: crm.error,
    })
  );
  const { clients, loading, error } = useSelector(selectCrmState);

  // Estados locales
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [contactToEdit, setContactToEdit] = useState<any>(null);
  const [info, setInfo] = useState<any>(null);
  const [modal, setModal] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Estados Super Admin
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [superLoading, setSuperLoading] = useState(false);

  // Check Role
  useEffect(() => {
    try {
      const t = getToken();
      if (t) {
        const dec: any = jwtDecode(t);
        if (dec?.user?.role_id === 99) setIsSuperAdmin(true);
      }
    } catch (e) { }
  }, []);

  // Cargar datos (Clientes o Tenants)
  useEffect(() => {
    if (isSuperAdmin) {
      setSuperLoading(true);
      api.get('/tenants')
        .then(({ data }: any) => setTenantList(data))
        .catch((err: any) => console.error(err))
        .finally(() => setSuperLoading(false));
    } else {
      dispatch(getContacts());
    }
  }, [dispatch, isSuperAdmin]);

  // Data Source Switch
  const dataToRender = isSuperAdmin ? tenantList : clients;
  const isLoading = isSuperAdmin ? superLoading : loading;

  // Seleccionar primer item
  useEffect(() => {
    if (dataToRender && dataToRender.length > 0) {
      const currentInfoExists = info && dataToRender.some((c: any) => c.id === info.id);
      if (!currentInfoExists) {
        setInfo(dataToRender[0]);
      }
    } else {
      setInfo(null);
    }
  }, [dataToRender, info]);

  // Toggle Modal
  const toggle = useCallback(() => {
    setModal((prevState) => !prevState);
  }, []);

  // Handle Add Client
  const handleAddClientClick = () => {
    setContactToEdit(null);
    setIsEdit(false);
    toggle();
  };

  // Handle Edit Client
  const handleEditClick = useCallback((arg: any) => {
    const contact = arg;
    setContactToEdit({
      id: contact.id,
      first_name: contact.name ? contact.name.split(' ')[0] : '',
      last_name: contact.name ? contact.name.split(' ').slice(1).join(' ') : '',
      email: contact.email,
      phone: contact.phone,
    });
    setIsEdit(true);
    toggle();
  }, [toggle]);

  // Handle Delete Client
  const onClickDelete = useCallback((contact: any) => {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminarlo'
    }).then((result) => {
      if (result.isConfirmed) {
        dispatch(deleteContact(contact.id));
      }
    });
  }, [dispatch]);

  // Form Validation
  const validation: any = useFormik({
    enableReinitialize: true,
    initialValues: {
      first_name: (contactToEdit && contactToEdit.first_name) || '',
      last_name: (contactToEdit && contactToEdit.last_name) || '',
      email: (contactToEdit && contactToEdit.email) || '',
      phone: (contactToEdit && contactToEdit.phone) || '',
      password: '',
    },
    validationSchema: Yup.object({
      first_name: Yup.string().required("Por favor ingrese el nombre"),
      last_name: Yup.string().required("Por favor ingrese el apellido"),
      email: Yup.string().email("Email inválido").required("Por favor ingrese el email"),
      password: isEdit ? Yup.string() : Yup.string().required("La contraseña es obligatoria"),
    }),
    onSubmit: (values) => {
      if (isEdit) {
        const updateContactData = {
          id: contactToEdit ? contactToEdit.id : 0,
          name: values.first_name + ' ' + values.last_name,
          email: values.email,
          phone: values.phone,
          // Add other fields if necessary
        };
        dispatch(updateContact(updateContactData));
      } else {
        const newContactData = {
          first_name: values.first_name,
          last_name: values.last_name,
          email: values.email,
          phone: values.phone,
          password: values.password,
        };
        dispatch(addNewContact(newContactData));
      }
      validation.resetForm();
      toggle();
    },
  });

  // Columnas Dinámicas
  const columns = useMemo(
    () => {
      if (isSuperAdmin) {
        return [
          {
            header: "Empresa", accessorKey: "name", enableColumnFilter: false,
            cell: (cell: any) => (
              <div className="d-flex align-items-center" role="button" onClick={() => setInfo(cell.row.original)} style={{ cursor: "pointer" }}>
                <div className="flex-shrink-0"><img src={cell.row.original.logo_url || dummyImg} alt="" className="avatar-xs rounded-circle" /></div>
                <div className="flex-grow-1 ms-2 fw-medium">{cell.getValue()}</div>
              </div>
            )
          },
          { header: "NIT / Tax ID", accessorKey: "tax_id", enableColumnFilter: false },
          { header: "Email", accessorKey: "email", enableColumnFilter: false },
          { header: "Teléfono", accessorKey: "phone", enableColumnFilter: false },
          {
            header: "Fecha Creación", accessorKey: "created_at", enableColumnFilter: false,
            cell: (cell: any) => new Date(cell.getValue()).toLocaleDateString()
          }
        ];
      }
      // Columnas Normales (Clientes)
      return [
        {
          header: "Cliente", accessorKey: "name", enableColumnFilter: false,
          cell: (cell: any) => {
            const rowData = cell.row.original;
            return (
              <div className="d-flex align-items-center" role="button" tabIndex={0} onClick={() => setInfo(rowData)} style={{ cursor: "pointer" }}>
                <div className="flex-shrink-0"><img src={rowData.img || dummyImg} alt="" className="avatar-xs rounded-circle" /></div>
                <div className="flex-grow-1 ms-2 name">{cell.getValue()}</div>
              </div>
            );
          },
        },
        { header: "Email", accessorKey: "email", enableColumnFilter: false },
        { header: "Teléfono", accessorKey: "phone", enableColumnFilter: false },
        { header: "Total Servicios", accessorKey: "cantidadServicios", enableColumnFilter: false },
        {
          header: "Últimos Servicios", accessorKey: "tags", enableColumnFilter: false,
          cell: (cell: any) => (
            <div className="d-flex flex-wrap gap-1">
              {(cell.getValue() || []).map((item: any, key: any) => (
                <span className="badge bg-primary-subtle text-primary" key={key}>{item}</span>
              ))}
            </div>
          ),
        },
        {
          header: "Acciones",
          cell: (cellProps: any) => (
            <UncontrolledDropdown>
              <DropdownToggle href="#" className="btn btn-soft-primary btn-sm dropdown" tag="button"><i className="ri-more-fill align-middle"></i></DropdownToggle>
              <DropdownMenu className="dropdown-menu-end">
                <DropdownItem onClick={() => setInfo(cellProps.row.original)}><i className="ri-eye-fill align-bottom me-2 text-muted"></i> Ver Detalles</DropdownItem>
                {!isSuperAdmin && (
                  <>
                    <DropdownItem onClick={() => handleEditClick(cellProps.row.original)}><i className="ri-pencil-fill align-bottom me-2 text-muted"></i> Editar</DropdownItem>
                    <DropdownItem onClick={() => onClickDelete(cellProps.row.original)}><i className="ri-delete-bin-fill align-bottom me-2 text-muted"></i> Eliminar</DropdownItem>
                  </>
                )}
              </DropdownMenu>
            </UncontrolledDropdown>
          ),
        },
      ];
    },
    [handleEditClick, isSuperAdmin, onClickDelete]
  );

  document.title = "Clientes | CRM";
  return (
    <React.Fragment>
      <div className="page-content">
        {/* Ya no se necesita el DeleteModal aquí */}
        <Container fluid>
          <BreadCrumb title="Clientes" pageTitle="CRM" />
          <Row>
            <Col lg={12}>
              <Card>
                <CardHeader>
                  {/* --- AJUSTE DEL BOTÓN --- */}
                  <div className="d-flex justify-content-end">
                    <button className="btn btn-primary add-btn" onClick={handleAddClientClick}><i className="ri-add-fill me-1 align-bottom"></i> Agregar cliente</button>
                  </div>
                </CardHeader>
              </Card>
            </Col>
            <Col xxl={9}>
              <Card id="contactList">
                <CardBody className="pt-0">
                  {isLoading && (!dataToRender || dataToRender.length === 0) ? <Loader /> : (
                    <TableContainer
                      columns={columns}
                      data={dataToRender || []}
                      isGlobalFilter={true}
                      customPageSize={10}
                      divClass="table-responsive table-card mb-3"
                      tableClass="align-middle table-nowrap"
                      theadClass="table-light"
                    />
                  )}
                  {!isLoading && error && !isSuperAdmin && <div className="alert alert-danger mt-3">Error al cargar los clientes: {error.error || 'Error desconocido'}</div>}
                </CardBody>
              </Card>
            </Col>
            <Col xxl={3}>
              <Card id="contact-view-detail">
                {info ? (
                  <>
                    <CardBody className="text-center">
                      <div className="position-relative d-inline-block"><img src={info.img || info.logo_url || dummyImg} alt="" className="avatar-lg rounded-circle img-thumbnail" /></div>
                      <h5 className="mt-4 mb-1">{isSuperAdmin ? info.name : info.name}</h5>
                      {isSuperAdmin && <p className="text-muted mb-0">{info.business_name}</p>}
                    </CardBody>
                    <CardBody>
                      <h6 className="text-muted text-uppercase fw-semibold mb-3">Información {isSuperAdmin ? 'Empresarial' : 'Personal'}</h6>
                      <div className="table-responsive table-card">
                        <Table className="table table-borderless mb-0">
                          <tbody>
                            <tr><td className="fw-medium">Email</td><td>{info.email || 'N/A'}</td></tr>
                            <tr><td className="fw-medium">Teléfono</td><td>{info.phone || 'N/A'}</td></tr>
                            {isSuperAdmin ? (
                              <>
                                <tr><td className="fw-medium">NIT</td><td>{info.tax_id || 'N/A'}</td></tr>
                                <tr><td className="fw-medium">Dirección</td><td>{info.address || 'N/A'}</td></tr>
                                <tr><td className="fw-medium">Ciudad</td><td>{info.city || 'N/A'}</td></tr>
                              </>
                            ) : (
                              <>
                                <tr><td className="fw-medium">Total Servicios</td><td>{info.cantidadServicios}</td></tr>
                                <tr>
                                  <td className="fw-medium">Últimos servicios</td>
                                  <td>
                                    {(info.tags && info.tags.length > 0) ? info.tags.map((item: any, key: any) => (
                                      <span className="badge bg-primary-subtle text-primary me-1" key={key}>{item}</span>
                                    )) : 'Sin servicios registrados'}
                                  </td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </Table>
                      </div>
                    </CardBody>
                  </>
                ) : (
                  <CardBody className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                    <p>{isLoading ? 'Cargando...' : 'Seleccione un elemento de la lista'}</p>
                  </CardBody>
                )}
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      <Modal id="showModal" isOpen={modal} toggle={toggle} centered>
        <ModalHeader className="bg-primary-subtle p-3" toggle={toggle}>
          {isEdit ? `Editar Cliente: ${contactToEdit?.first_name || ''} ${contactToEdit?.last_name || ''}`.trim() : "Agregar Cliente"}
        </ModalHeader>
        <Form onSubmit={validation.handleSubmit}>
          <ModalBody>
            <Row className="g-3">
              <Col md={6}>
                <Label htmlFor="first_name-field">Nombre</Label>
                <Input name="first_name" onChange={validation.handleChange} onBlur={validation.handleBlur} value={validation.values.first_name} invalid={!!(validation.touched.first_name && validation.errors.first_name)} />
                {validation.touched.first_name && validation.errors.first_name && <FormFeedback>{validation.errors.first_name as string}</FormFeedback>}
              </Col>
              <Col md={6}>
                <Label htmlFor="last_name-field">Apellido</Label>
                <Input name="last_name" onChange={validation.handleChange} onBlur={validation.handleBlur} value={validation.values.last_name} />
              </Col>
              <Col md={12}>
                <Label htmlFor="email-field">Email</Label>
                <Input name="email" type="email" onChange={validation.handleChange} onBlur={validation.handleBlur} value={validation.values.email} invalid={!!(validation.touched.email && validation.errors.email)} />
                {validation.touched.email && validation.errors.email && <FormFeedback>{validation.errors.email as string}</FormFeedback>}
              </Col>
              <Col md={12}>
                <Label htmlFor="phone-field">Teléfono</Label>
                <Input name="phone" onChange={validation.handleChange} onBlur={validation.handleBlur} value={validation.values.phone} />
              </Col>
              {!isEdit && (
                <Col md={12}>
                  <Label htmlFor="password-field">Contraseña</Label>
                  <InputGroup>
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
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
                      <i className={showPassword ? "ri-eye-off-fill" : "ri-eye-fill"}></i>
                    </button>
                    {validation.touched.password && validation.errors.password && <FormFeedback>{validation.errors.password as string}</FormFeedback>}
                  </InputGroup>
                </Col>
              )}
            </Row>
          </ModalBody>
          <ModalFooter>
            <div className="hstack gap-2 justify-content-end">
              <button type="button" className="btn btn-light" onClick={toggle}>Cerrar</button>
              <button type="submit" className="btn btn-success" disabled={validation.isSubmitting}>
                {validation.isSubmitting ? <Spinner size="sm" /> : (isEdit ? "Guardar Cambios" : "Agregar Cliente")}
              </button>
            </div>
          </ModalFooter>
        </Form>
      </Modal>

      {/* Ya no se necesita el ToastContainer */}
    </React.Fragment>
  );
};

export default CrmContacts;