import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import SimpleBar from "simplebar-react";
//import logo
import logoWhite from "../assets/images/logo/logowhite.png";
import logoCrumiSmall from "../assets/images/logo/logowhite.png";

//Import Components
import VerticalLayout from "./VerticalLayouts";
import TwoColumnLayout from "./TwoColumnLayout";
import { Container } from "reactstrap";
import HorizontalLayout from "./HorizontalLayout";
import WorkspaceSelector from "../Components/Common/WorkspaceSelector";
import { useTenantLogo } from "../hooks/useTenantLogo";

const Sidebar = ({ layoutType } : any) => {
  const { tenantLogo, tenantName, loading } = useTenantLogo();
  
  // Usar logo del tenant si existe, sino el de Bolti
  const displayLogo = tenantLogo || logoWhite;
  const logoTitle = tenantLogo ? tenantName : 'Bolti';

  useEffect(() => {
    var verticalOverlay = document.getElementsByClassName("vertical-overlay");
    if (verticalOverlay) {
      verticalOverlay[0].addEventListener("click", function () {
        document.body.classList.remove("vertical-sidebar-enable");
      });
    }
  });

  const addEventListenerOnSmHoverMenu = () => {
    // add listener Sidebar Hover icon on change layout from setting
    if (document.documentElement.getAttribute('data-sidebar-size') === 'sm-hover') {
      document.documentElement.setAttribute('data-sidebar-size', 'sm-hover-active');
    } else if (document.documentElement.getAttribute('data-sidebar-size') === 'sm-hover-active') {
      document.documentElement.setAttribute('data-sidebar-size', 'sm-hover');
    } else {
      document.documentElement.setAttribute('data-sidebar-size', 'sm-hover');
    }
  };

  return (
    <React.Fragment>
      <div className="app-menu navbar-menu">
        <div className="navbar-brand-box">
          <Link to="/" className="logo logo-dark" title={logoTitle}>
            <span className="logo-sm">
              <img src={displayLogo} alt={logoTitle} height="50" style={{ maxWidth: '100%', objectFit: 'contain' }} />
            </span>
            <span className="logo-lg">
              <img src={displayLogo} alt={logoTitle} height="45" style={{ maxWidth: '100%', objectFit: 'contain' }} />
            </span>
          </Link>

          <Link to="/" className="logo logo-light" title={logoTitle}>
            <span className="logo-sm">
              <img src={displayLogo} alt={logoTitle} height="50" style={{ maxWidth: '100%', objectFit: 'contain' }} />
            </span>
            <span className="logo-lg">
              <img src={displayLogo} alt={logoTitle} height="45" style={{ maxWidth: '100%', objectFit: 'contain' }} />
            </span>
          </Link>
          <button
            onClick={addEventListenerOnSmHoverMenu}
            type="button"
            className="btn btn-sm p-0 fs-20 header-item float-end btn-vertical-sm-hover"
            id="vertical-hover"
          >
            <i className="ri-record-circle-line"></i>
          </button>
        </div>
        {/* Selector de espacio de trabajo (estilo Alegra) - debajo del logo */}
        {layoutType !== "horizontal" && layoutType !== "twocolumn" && (
          <div className="workspace-selector-wrapper" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            <WorkspaceSelector />
          </div>
        )}
        {layoutType === "horizontal" ? (
          <div id="scrollbar">
            <Container fluid>
              <div id="two-column-menu"></div>
              <ul className="navbar-nav" id="navbar-nav">
                <HorizontalLayout />
              </ul>
            </Container>
          </div>
        ) : layoutType === 'twocolumn' ? (
          <React.Fragment>
            <TwoColumnLayout layoutType={layoutType} />
            <div className="sidebar-background"></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <SimpleBar id="scrollbar" className="h-100">
              <Container fluid>
                <div id="two-column-menu"></div>
                <ul className="navbar-nav" id="navbar-nav">
                  <VerticalLayout layoutType={layoutType} />
                </ul>
              </Container>
              {/* Logo de Bolti pequeño al final del sidebar */}
              {tenantLogo && (
                <div className="sidebar-crumi-footer" style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(0,0,0,0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Powered by Bolti</span>
                  </div>
                </div>
              )}
            </SimpleBar>
            <div className="sidebar-background"></div>
          </React.Fragment>
        )}
      </div>
      <div className="vertical-overlay"></div>
    </React.Fragment>
  );
};

export default Sidebar;
