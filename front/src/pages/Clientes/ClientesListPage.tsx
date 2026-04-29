// ClientesListPage.tsx
// Página principal para el listado de clientes/empresas de facturas
// Estilo completo inspirado en Velzon CRM Contacts

import React from 'react';
import { Container } from 'reactstrap';
import ClientesList from '../Pages/Profile/Settings/ClientesList';
import BreadCrumb from '../../Components/Common/BreadCrumb';

const ClientesListPage: React.FC = () => {
  return (
    <div className="page-content">
      <Container fluid>
        <BreadCrumb title="Listado de Clientes" pageTitle="Gestión" />
        <ClientesList />
      </Container>
    </div>
  );
};

export default ClientesListPage;
