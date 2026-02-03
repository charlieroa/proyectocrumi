import React, { useEffect, useState } from 'react'
import { Button, Col, Form, FormFeedback, Input, Label, Modal, ModalBody, ModalFooter, ModalHeader, Row } from 'reactstrap';
import Flatpickr from 'react-flatpickr'
// import Select from 'react-select';
// import moment from 'moment';
import * as Yup from "yup";
import { useDispatch } from 'react-redux';
import { useFormik } from 'formik';
import { addNewInvoice as onAddInvoice, updateInvoice as onUpdateInvoice } from 'slices/thunks';

import dummy from "assets/images/users/user-dummy-img.jpg"

interface modal {
    isShow: boolean,
    isEdit: any,
    edit: any,
    handleShow: any,
    handleClose: any,
}

const AddEditInvoice = ({ edit, isEdit, handleShow, handleClose, isShow }: modal) => {

    // Date
    const defaultdate = () => {
        let d = new Date(),
            months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let h = (d.getHours() % 12) || 12;
        let ampm = d.getHours() < 12 ? "AM" : "PM";
        return ((d.getDate() + ' ' + months[d.getMonth()] + ', ' + d.getFullYear() + ", " + h + ":" + d.getMinutes() + " " + ampm).toString());
    };


    const [date, setDate] = useState(defaultdate());
    console.log(date)

    const dateformate = (e: any) => {
        const dateString = e.toString().split(" ");

        let time = dateString[4];
        let H = +time.substr(0, 2);
        let h: any = (H % 12) || 12;
        h = (h <= 9) ? h = ("0" + h) : h;
        let ampm = H < 12 ? "AM" : "PM";
        time = h + time.substr(2, 3) + " " + ampm;

        const date = dateString[2] + " " + dateString[1] + ", " + dateString[3];
        const orderDate = (date + ", " + time).toString();
        setDate(orderDate);

    };

    // image
    const [selectedImage, setSelectedImage] = useState<any>();

    const handleImageChange = (event: any) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e: any) => {
            formik.setFieldValue('picture', e.target.result);
            setSelectedImage(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    const dispatch = useDispatch<any>();

    const formik: any = useFormik({
        enableReinitialize: true,
        initialValues: {
            id: (edit && edit.id) || '',
            invoiceId: (edit && edit.invoiceId) || '',
            picture: (edit && edit.picture) || '',
            name: (edit && edit.name) || '',
            email: (edit && edit.email) || '',
            country: (edit && edit.country) || '',
            date: (edit && edit.date) || '',
            amount: (edit && edit.amount) || '',

        },
        validationSchema: Yup.object({
            invoiceId: Yup.string().required("Please Enter InvoiceID"),
            name: Yup.string().required("Please Enter Your Name"),
            email: Yup.string().email().required('Please Enter Email'),
            country: Yup.string().required('Please Enter the Country name'),
            date: Yup.string().required('Please Enter Date & Time'),
            amount: Yup.string().required('Please Enter Amount'),
        }),
        onSubmit: (values: any) => {
            if (isEdit) {
                const UpdateInvoice = {
                    id: values.id,
                    invoiceId: values.invoiceId,
                    picture: values.picture,
                    name: values.name,
                    email: values.email,
                    country: values.country,
                    date: values.date,
                    amount: values.amount,
                }
                dispatch(onUpdateInvoice(UpdateInvoice));
                formik.resetForm();
            } else {
                const newInvoice = {
                    id: (Math.floor(Math.random() * (30 - 20)) + 20),
                    invoiceId: values['invoiceId'],
                    //   picture: selectedImage,
                    picture: values['picture'],
                    name: values['name'],
                    email: values['email'],
                    country: values['country'],
                    date: values['date'],
                    amount: values['amount'],
                }
                dispatch(onAddInvoice(newInvoice));
                formik.resetForm();
            }

            if (values == null) {
                handleShow();
            } else {
                handleClose();
            }
        }
    });

    useEffect(() => {
        setSelectedImage('');
    }, [handleClose])

    useEffect(() => {
        setSelectedImage(edit?.picture);
    }, [edit])

    return (
        <React.Fragment>
            <Modal show={isShow} toggle={handleClose} centered id="showModal" >
                <ModalHeader as="h5" closeButton className="bg-soft-info p-3">
                    <div id="createTaskLabel">{!!isEdit ? "Edit Customer" : "Add customer"}</div>
                </ModalHeader>
                <Form className="tablelist-form" autoComplete="off" onSubmit={(e: any) => {
                    e.preventDefault();
                    formik.handleSubmit();
                    return false;
                }

                }>
                    <ModalBody>
                        <div id="alert-error-msg" className="d-none alert alert-danger py-2"></div>
                        <input type="hidden" id="id-field" />
                        <Row className="g-3">
                            <Col lg={12}>
                                <div className="text-center">
                                    <div className="position-relative d-inline-block">
                                        <div className="position-absolute bottom-0 end-0">
                                            <Label htmlFor="customer-image-input" className="mb-0" data-bs-toggle="tooltip" data-bs-placement="right" title="Select Image">
                                                <div className="avatar-xs cursor-pointer">
                                                    <div className="avatar-title bg-light border rounded-circle text-muted">
                                                        <i className="ri-image-fill"></i>
                                                    </div>
                                                </div>
                                            </Label>
                                            <Input className="form-control d-none" value="" id="customer-image-input" type="file" accept="image/png, image/gif, image/jpeg" onChange={handleImageChange} />
                                        </div>
                                        <div className="avatar-lg p-1">
                                            <div className="avatar-title bg-light rounded-circle">
                                                <img src={selectedImage || dummy} alt="" id="customer-img" className="avatar-md rounded-circle object-cover" />
                                            </div>
                                        </div>
                                    </div>
                                    {formik.errors.picture && formik.touched.picture ? (
                                        <FormFeedback type="invalid"> {formik.errors.picture} </FormFeedback>
                                    ) : null}
                                </div>

                            </Col>

                            <Col lg={12}>
                                <Label htmlFor="invoiceid-field">invoiceId</Label>
                                <Input
                                    type="text"
                                    id="invoiceid-field"
                                    className="form-control"
                                    placeholder="Enter InvoiceId"
                                    required
                                    name='invoiceId'
                                    value={formik.values.invoiceId || ''}
                                    onChange={formik.handleChange}
                                    isInvalid={!!formik.errors.invoiceId}
                                />
                                {formik.errors.invoiceId && formik.touched.invoiceId ? (
                                    <FormFeedback type="invalid">{formik.errors.invoiceId}</FormFeedback>
                                ) : null}
                            </Col>

                            <Col lg={12}>
                                <Label htmlFor="name-field">Name</Label>
                                <Input
                                    type="text"
                                    id="name-field"
                                    className="form-control"
                                    placeholder="Enter Name"
                                    required
                                    name='name'
                                    value={formik.values.name || ''}
                                    onChange={formik.handleChange}
                                    isInvalid={!!formik.errors.name}
                                />
                                {formik.errors.name && formik.touched.name ? (
                                    <FormFeedback type="invalid">{formik.errors.name}</FormFeedback>
                                ) : null}
                            </Col>

                            <Col lg={12}>
                                <div>
                                    <Label htmlFor="email-field">Email ID</Label>
                                    <Input type="text" id="email-field" className="form-control" placeholder="Enter email" required
                                        name='email'
                                        value={formik.values.email || ''}
                                        onChange={formik.handleChange}
                                        isInvalid={!!formik.errors.email} />
                                    {formik.errors.email && formik.touched.email ? (
                                        <FormFeedback type="invalid">{formik.errors.email}</FormFeedback>
                                    ) : null}
                                </div>
                            </Col>

                            <Col lg={12}>
                                <div>
                                    <Label htmlFor="country-field">Country</Label>
                                    <Input type="text" id="country-field" className="form-control" placeholder="Enter Country Name" required
                                        name='country'
                                        value={formik.values.country || ''}
                                        onChange={formik.handleChange}
                                        isInvalid={!!formik.errors.country} />
                                    {formik.errors.country && formik.touched.country ? (
                                        <FormFeedback type="invalid">{formik.errors.country}</FormFeedback>
                                    ) : null}
                                </div>
                            </Col>

                            <Col lg={12}>
                                <div >
                                    <label htmlFor="date-field">Date</label>
                                    <Flatpickr
                                        name="date"
                                        className="form-control"
                                        id="datepicker-input"
                                        placeholder="Select a date and time"
                                        options={{
                                            enableTime: true,
                                            altInput: true,
                                            altFormat: "d M, Y, G:i K",
                                            dateFormat: "d M, Y, G:i K",
                                        }}
                                        onChange={(date: any) =>
                                            dateformate(date)
                                        }
                                        value={formik.values.date || ""}
                                    />
                                    {formik.errors.date && formik.touched.date ? (
                                        <FormFeedback type="invalid">{formik.errors.date}</FormFeedback>
                                    ) : null}
                                </div>
                            </Col>

                            <Col lg={12}>
                                <div>
                                    <Label htmlFor="amount-field">Amount</Label>
                                    <Input type="text" id="amount-field" className="form-control" placeholder="Enter Amount" required
                                        name='amount'
                                        value={formik.values.amount || ''}
                                        onChange={formik.handleChange}
                                        isInvalid={!!formik.errors.amount} />
                                    {formik.errors.amount && formik.touched.amount ? (
                                        <FormFeedback type="invalid">{formik.errors.amount}</FormFeedback>
                                    ) : null}
                                </div>
                            </Col>

                            <Col lg={12}>
                                <div>
                                    <label htmlFor="status-field">Status</label>
                                    <select
                                        name="status" id="status-field"
                                        value={formik.values.status || ''}
                                        onChange={formik.handleChange}
                                        onBlur={formik.handleBlur}
                                    //   isInvalid={!!formik.errors.status}
                                    >
                                        <option value="Paid">Paid</option>
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Cancel">Cancel</option>
                                        <option value="Refund">Refund</option>
                                        <option value="Active">Active</option>
                                    </select>
                                    {formik.errors.status && formik.touched.status ? (
                                        <FormFeedback type="invalid">{formik.errors.status}</FormFeedback>
                                    ) : null}
                                </div>
                            </Col>

                        </Row>
                    </ModalBody>
                    <ModalFooter>
                        <div className="hstack gap-2 justify-content-end">
                            <Button variant="light"
                            // onClick={handleClose}
                            >
                                Close
                            </Button>
                            <Button variant="success" id="add-btn" type="submit">
                                {!!isEdit ? "Update" : "Add customer"}
                            </Button>
                        </div>
                    </ModalFooter>
                </Form>
            </Modal>
        </React.Fragment>
    )
}

export default AddEditInvoice