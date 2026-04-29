import React, { useState } from 'react';
import { Col, Dropdown, DropdownMenu, DropdownToggle, Row } from 'reactstrap';
import bell from "../../assets/images/svg/bell.svg";

const NotificationDropdown = () => {
    const [isNotificationDropdown, setIsNotificationDropdown] = useState<boolean>(false);
    const toggleNotificationDropdown = () => {
        setIsNotificationDropdown(!isNotificationDropdown);
    };

    return (
        <React.Fragment>
            <Dropdown isOpen={isNotificationDropdown} toggle={toggleNotificationDropdown} className="topbar-head-dropdown ms-1 header-item">
                <DropdownToggle type="button" tag="button" className="btn btn-icon btn-topbar btn-ghost-secondary rounded-circle shadow-none">
                    <i className='bx bx-bell fs-22'></i>
                    {/* Badge de notificaciones oculto por ahora */}
                    {/* <span
                        className="position-absolute topbar-badge fs-10 translate-middle badge rounded-pill bg-danger">3<span
                            className="visually-hidden">unread messages</span></span> */}
                </DropdownToggle>
                <DropdownMenu className="dropdown-menu-lg dropdown-menu-end p-0">
                    <div className="dropdown-head bg-primary bg-pattern rounded-top">
                        <div className="p-3">
                            <Row className="align-items-center">
                                <Col>
                                    <h6 className="m-0 fs-16 fw-semibold text-white"> Notificaciones </h6>
                                </Col>
                            </Row>
                        </div>
                    </div>

                    <div className="p-4">
                        <div className="text-center">
                            <div className="w-25 w-sm-50 pt-3 mx-auto">
                                <img src={bell} className="img-fluid" alt="no-notifications" />
                            </div>
                            <div className="text-center pb-5 mt-2">
                                <h6 className="fs-18 fw-semibold lh-base">No tienes notificaciones por ahora</h6>
                            </div>
                        </div>
                    </div>
                </DropdownMenu>
            </Dropdown>
        </React.Fragment>
    );
};

export default NotificationDropdown;