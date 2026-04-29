// =============================================
// File: src/pages/Calendar/index.tsx
// =============================================
import React, { useEffect, useState } from "react";
import { Card, CardBody, Container, Row, Col } from "reactstrap";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import BootstrapTheme from "@fullcalendar/bootstrap";
import listPlugin from "@fullcalendar/list";
import esLocale from "@fullcalendar/core/locales/es";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2"; // NUEVO: Importamos SweetAlert
// Thunks
import {
  getCalendarData as onGetCalendarData,
  updateAppointment as onUpdateAppointment,
  fetchTenantSettings,
} from "../../slices/thunks";

// Componentes
import BreadCrumb from "../../Components/Common/BreadCrumb";
import CentroDeCitasDiarias from "../../Components/Calendar/CentroDeCitasDiarias";
import AppointmentModal from "../../Components/Calendar/AppointmentModal";

const isDayOpen = (date: Date, workingHours: any): boolean => {
  if (!workingHours || typeof workingHours !== 'object' || Object.keys(workingHours).length === 0) {
    return true;
  }
  const dayIndex = date.getDay();
  const esKey = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][dayIndex];
  const enKey = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayIndex];
  const daySchedule = workingHours[esKey] || workingHours[enKey];

  if (daySchedule === undefined) {
    return true;
  }
  if (typeof daySchedule === 'string' && (daySchedule.toLowerCase() === 'cerrado' || daySchedule.toLowerCase() === 'closed')) {
    return false;
  }
  if (typeof daySchedule === 'object' && daySchedule !== null && daySchedule.active === false) {
    return false;
  }
  return true;
};

const Calendar = () => {
  document.title = "Calendario | Sistema de Peluquerías";
  const dispatch: any = useDispatch();

  const { events, loading, tenantWorkingHours } = useSelector((state: any) => state.Calendar);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  useEffect(() => {
    dispatch(onGetCalendarData());
    dispatch(fetchTenantSettings());
  }, [dispatch]);

  // --- HANDLER MODIFICADO CON SWEETALERT ---
  const handleDateClick = (arg: any) => {
    const clickedDate = arg.date;

    if (isDayOpen(clickedDate, tenantWorkingHours)) {
      setSelectedEvent(null);
      setDefaultDate(clickedDate);
      setModalOpen(true);
    } else {
      // Esta línea ahora muestra una alerta de SweetAlert
      Swal.fire({
        title: 'Día no disponible',
        text: 'Este día no está seleccionado en tu configuración.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Entendido'
      });
    }
  };

  const handleEventClick = (arg: any) => {
    setSelectedEvent(arg.event.extendedProps);
    setDefaultDate(null);
    setModalOpen(true);
  };

  const handleNewAppointmentClick = () => {
    setSelectedEvent(null);
    setDefaultDate(null);
    setModalOpen(true);
  };

  const handleEventDrop = (dropInfo: any) => {
    const { event } = dropInfo;
    const updatedPayload = {
      ...event.extendedProps,
      id: event.id,
      start_time: event.start.toISOString(),
    };
    dispatch(onUpdateAppointment(updatedPayload)).catch(() => dropInfo.revert());
  };

  if (loading) {
    return (
      <div className="page-content">
        <Container fluid>
          <p>Cargando...</p>
        </Container>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="page-content">
        <Container fluid>
          <BreadCrumb title="Calendario" pageTitle="Citas" />
          <Row>
            <Col xl={3}>
              <CentroDeCitasDiarias
                events={events}
                onNewAppointmentClick={handleNewAppointmentClick}
              />
            </Col>
            <Col xl={9}>
              <Card className="card-h-100">
                <CardBody>
                  <FullCalendar
                    plugins={[BootstrapTheme, dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
                    events={events}
                    editable={true}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    eventDrop={handleEventDrop}
                    locale={esLocale}
                    buttonText={{ today: "Hoy", month: "Mes", week: "Semana", day: "Día", list: "Lista" }}
                  />
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedEvent={selectedEvent}
        defaultDate={defaultDate}
      />
    </React.Fragment>
  );
};

export default Calendar;