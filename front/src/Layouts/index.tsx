import React, { useEffect, useState } from 'react';
import PropTypes from "prop-types";
import withRouter from '../Components/Common/withRouter';
import { useLocation } from 'react-router-dom';

//import Components
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import RightSidebar from '../Components/Common/RightSidebar';
import { ErrorBoundary } from '../Components/Common/ErrorBoundary';

// import api and sweetalert
import { api } from "../services/api";
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

// import auth utils
import { getToken } from "../services/auth";
import { jwtDecode } from "jwt-decode";

//import actions
import {
    changeLayout,
    changeSidebarTheme,
    changeLayoutMode,
    changeLayoutWidth,
    changeLayoutPosition,
    changeTopbarTheme,
    changeLeftsidebarSizeType,
    changeLeftsidebarViewType,
    changeSidebarImageType,
    changeSidebarVisibility
} from "../slices/thunks";

//redux
import { useSelector, useDispatch } from "react-redux";
import { createSelector } from 'reselect';

const Layout = (props: any) => {
    const [headerClass, setHeaderClass] = useState("");
    const dispatch: any = useDispatch();
    const location = useLocation();
    const navigate = useNavigate();

    const selectLayoutState = (state: any) => state.Layout;
    const selectLayoutProperties = createSelector(
        selectLayoutState,
        (layout) => ({
            layoutType: layout.layoutType,
            leftSidebarType: layout.leftSidebarType,
            layoutModeType: layout.layoutModeType,
            layoutWidthType: layout.layoutWidthType,
            layoutPositionType: layout.layoutPositionType,
            topbarThemeType: layout.topbarThemeType,
            leftsidbarSizeType: layout.leftsidbarSizeType,
            leftSidebarViewType: layout.leftSidebarViewType,
            leftSidebarImageType: layout.leftSidebarImageType,
            preloader: layout.preloader,
            sidebarVisibilitytype: layout.sidebarVisibilitytype,
        })
    );
    // Inside your component
    const {
        layoutType,
        leftSidebarType,
        layoutModeType,
        layoutWidthType,
        layoutPositionType,
        topbarThemeType,
        leftsidbarSizeType,
        leftSidebarViewType,
        leftSidebarImageType,
        sidebarVisibilitytype
    } = useSelector(selectLayoutProperties);

    /*
    layout settings
    */
    useEffect(() => {
        if (
            layoutType ||
            leftSidebarType ||
            layoutModeType ||
            layoutWidthType ||
            layoutPositionType ||
            topbarThemeType ||
            leftsidbarSizeType ||
            leftSidebarViewType ||
            leftSidebarImageType ||
            sidebarVisibilitytype
        ) {
            window.dispatchEvent(new Event('resize'));
            dispatch(changeLeftsidebarViewType(leftSidebarViewType));
            dispatch(changeLeftsidebarSizeType(leftsidbarSizeType));
            dispatch(changeSidebarTheme(leftSidebarType));
            dispatch(changeLayoutMode(layoutModeType));
            dispatch(changeLayoutWidth(layoutWidthType));
            dispatch(changeLayoutPosition(layoutPositionType));
            dispatch(changeTopbarTheme(topbarThemeType));
            dispatch(changeLayout(layoutType));
            dispatch(changeSidebarImageType(leftSidebarImageType));
            dispatch(changeSidebarVisibility(sidebarVisibilitytype));
        }
    }, [layoutType,
        leftSidebarType,
        layoutModeType,
        layoutWidthType,
        layoutPositionType,
        topbarThemeType,
        leftsidbarSizeType,
        leftSidebarViewType,
        leftSidebarImageType,
        sidebarVisibilitytype,
        dispatch]);
    /*
    call dark/light mode
    */
    const onChangeLayoutMode = (value: any) => {
        if (changeLayoutMode) {
            dispatch(changeLayoutMode(value));
        }
    };

    // class add remove in header 
    useEffect(() => {
        window.addEventListener("scroll", scrollNavigation, true);
    });

    function scrollNavigation() {
        var scrollup = document.documentElement.scrollTop;
        if (scrollup > 50) {
            setHeaderClass("topbar-shadow");
        } else {
            setHeaderClass("");
        }
    }

    useEffect(() => {
        const humberIcon = document.querySelector(".hamburger-icon") as HTMLElement;
        if (sidebarVisibilitytype === 'show' || layoutType === "vertical" || layoutType === "twocolumn") {
            humberIcon?.classList.remove('open');
        } else {
            humberIcon && humberIcon.classList.add('open');
        }
    }, [sidebarVisibilitytype, layoutType]);

    // --- NUEVO: Verificación de configuración inicial ---
    useEffect(() => {
        const exemptRoutes = ['/settings', '/login', '/register', '/register-tenant', '/register-contador', '/forgot-password', '/auth-google-callback', '/empresas', '/contadores', '/tasks/kanban'];
        if (exemptRoutes.some(r => location.pathname.startsWith(r))) return;

        // SKIP FOR SUPER ADMIN, CONTADOR Y EMPLEADOS
        try {
            const token = getToken();
            if (token) {
                const decoded: any = jwtDecode(token);
                const roleId = Number(decoded?.user?.role_id);
                if (roleId === 99 || roleId === 3 || roleId === 4) return;
            }
        } catch (e) { console.error(e); }

        const checkSetup = async () => {
            try {
                // Verificar setup solo si hay token (asumimos que api interceptor lo maneja o que estamos logueados)
                // Si falla 401, no pasa nada
                const { data } = await api.get('/tenants/setup-status');
                if (data && data.isConfigured === false) {
                    Swal.fire({
                        title: 'Configuración Incompleta',
                        text: 'Debes completar la información de tu empresa antes de continuar.',
                        icon: 'info',
                        confirmButtonText: 'Completar ahora',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then(() => {
                        navigate('/settings');
                    });
                }
            } catch (error) {
                // Silencioso en error (ej. network error o 401)
                // console.warn("Setup check failed", error);
            }
        };
        checkSetup();
    }, [location.pathname, navigate]);

    return (
        <React.Fragment>
            <div id="layout-wrapper">
                <Header
                    headerClass={headerClass}
                    layoutModeType={layoutModeType}
                    onChangeLayoutMode={onChangeLayoutMode} />
                <Sidebar
                    layoutType={layoutType}
                />
                <div className="main-content">
                    <ErrorBoundary>{props.children}</ErrorBoundary>
                    <Footer />
                </div>
            </div>
            <RightSidebar />
        </React.Fragment>

    );
};

Layout.propTypes = {
    children: PropTypes.object,
};

export default withRouter(Layout);