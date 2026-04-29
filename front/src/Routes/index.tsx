import React from 'react';
import { Routes, Route } from "react-router-dom";

//Layouts
import NonAuthLayout from "../Layouts/NonAuthLayout";
import CrumiLayout from "../Layouts/CrumiLayout";
import AuthProtected from "./AuthProtected"

//routes
import { authProtectedRoutes, publicRoutes, semiPublicRoutes } from "./allRoutes";

const Index = () => {
    return (
        <Routes>
            {/* Public routes without layout (login, register, etc.) */}
            {publicRoutes.map((route: any, idx: number) => (
                <Route
                    key={`p-${idx}`}
                    path={route.path}
                    element={<NonAuthLayout>{route.component}</NonAuthLayout>}
                />
            ))}
            {/* Semi-public routes (dashboard/chat accessible without login) */}
            {semiPublicRoutes.map((route: any, idx: number) => (
                <Route
                    key={`sp-${idx}`}
                    path={route.path}
                    element={<CrumiLayout>{route.component}</CrumiLayout>}
                />
            ))}
            {/* Auth-protected routes with CrumiLayout */}
            {authProtectedRoutes.map((route: any, idx: number) => (
                <Route
                    key={`a-${idx}`}
                    path={route.path}
                    element={
                        <AuthProtected>
                            <CrumiLayout>{route.component}</CrumiLayout>
                        </AuthProtected>
                    }
                />
            ))}
        </Routes>
    );
};

export default Index;
