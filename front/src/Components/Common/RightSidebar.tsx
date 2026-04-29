// src/Components/Common/RightSidebar.tsx
// Botón flotante con mini-chat de Asistente IA

import React, { useEffect, useState } from 'react';
import { useSelector } from "react-redux";
import { createSelector } from 'reselect';
import FloatingChat from './FloatingChat';

const RightSidebar = () => {
    // Estado del chat flotante
    const [chatOpen, setChatOpen] = useState<boolean>(false);
    const toggleChat = () => {
        setChatOpen(!chatOpen);
    };

    // Selector para preloader
    const selectLayoutState = (state: any) => state.Layout;
    const selectLayoutProperties = createSelector(
        selectLayoutState,
        (layout: any) => ({
            preloader: layout.preloader,
        })
    );
    const { preloader } = useSelector(selectLayoutProperties);

    // Scroll to top
    window.onscroll = function () {
        scrollFunction();
    };

    const scrollFunction = () => {
        const element = document.getElementById("back-to-top");
        if (element) {
            if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
                element.style.display = "block";
            } else {
                element.style.display = "none";
            }
        }
    };

    const toTop = () => {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    };

    const pathName = window.location.pathname;

    useEffect(() => {
        const preloaderEl = document.getElementById("preloader") as HTMLElement;

        if (preloaderEl) {
            preloaderEl.style.opacity = "1";
            preloaderEl.style.visibility = "visible";

            setTimeout(function () {
                preloaderEl.style.opacity = "0";
                preloaderEl.style.visibility = "hidden";
            }, 1000);
        }
    }, [pathName]);

    return (
        <React.Fragment>
            {/* Botón volver arriba */}
            <button
                onClick={() => toTop()}
                className="btn btn-danger btn-icon" id="back-to-top">
                <i className="ri-arrow-up-line"></i>
            </button>

            {/* Preloader */}
            {preloader === "enable" && <div id="preloader">
                <div id="status">
                    <div className="spinner-border text-primary avatar-sm" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>}

            {/* Botón flotante de Asistente IA */}
            <div>
                <div className="customizer-setting d-none d-md-block">
                    <button
                        onClick={toggleChat}
                        className="btn-info rounded-pill shadow-lg btn btn-icon btn-lg p-2"
                        title="Asistente IA"
                        style={{ border: 'none' }}
                    >
                        <i className='ri-sparkling-line fs-22'></i>
                    </button>
                </div>

                {/* Mini-Chat flotante */}
                <FloatingChat isOpen={chatOpen} toggle={toggleChat} />
            </div>
        </React.Fragment>
    );
};

export default RightSidebar;