import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from 'reactstrap';
import BreadCrumb from '../../../Components/Common/BreadCrumb';
import TasksKanban from './MainPage';
import { getRoleFromToken, isContadorFullMode } from '../../../services/auth';

const Kanbanboard = () => {
    const navigate = useNavigate();
    document.title = "Kanban Board | Bolti";

    useEffect(() => {
        const role = getRoleFromToken();
        if (role === 4 && !isContadorFullMode()) {
            navigate('/', { replace: true });
        }
    }, [navigate]);

    return (
        <React.Fragment>
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Kanban Board" pageTitle="Tasks" />
                    <TasksKanban />
                </Container>
            </div>
        </React.Fragment>
    );
};

export default Kanbanboard;
