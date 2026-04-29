// =============================================
// File: src/pages/Calendar/AppointmentModal.tsx
// (Versión completa con FIX NaN:NaN en el select de Hora)
// =============================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Col,
  Form,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Row,
  Spinner,
} from "reactstrap";
import * as Yup from "yup";
import { useFormik } from "formik";
import Flatpickr from "react-flatpickr";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";

// Thunks activos
import {
  updateAppointment as onUpdateAppointment,
  createNewClient as onCreateNewClient,
  createAppointmentsBatch as onCreateAppointmentsBatch,
  fetchTenantSlots, // Horarios del salón
  fetchAvailableStylists, // Estilistas disponibles (ordenados)
} from "../../slices/thunks";

// Tipos
interface AppointmentFormValues {
  client_id: string;
  service_id: string;
  stylist_id: string;
  date: string | Date;
  start_time: string; // HH:mm
  newClientFirstName: string;
  newClientLastName: string;
  newClientPhone: string;
  newClientEmail: string;
}

type Stylist = { id: string | number; first_name?: string; last_name?: string };
type ExtraRow = { service_id: string; stylist_id: string };

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: any | null;
  defaultDate?: Date | null;
}

// Helpers
const toYyyyMmDd = (d: string | Date): string => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().split("T")[0];
};

const toHHmmLocal = (d: string | Date) => {
  const dt = new Date(d);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

/**
 * Normaliza lo que devuelva el thunk de slots a siempre ["HH:mm", ...]
 * Soporta:
 * - ["HH:mm", ...]  (nuevo backend en modo compat)
 * - [{ local_time, utc, local }, ...] (si usas *_meta directo)
 * - ["2025-09-22T14:00:00Z", ...] (ISO antiguo)
 * - { slots: [...] } envoltorio
 */
function normalizeSlotsPayload(payload: any): string[] {
  const raw = Array.isArray(payload) ? payload : (payload?.slots ?? payload?.data?.slots ?? []);

  if (!Array.isArray(raw)) return [];

  if (raw.length === 0) return [];

  const first = raw[0];

  // Caso 1: ya vienen como "HH:mm"
  if (typeof first === "string" && first.length === 5 && first.includes(":")) {
    return raw as string[];
  }

  // Caso 2: objetos con local_time
  if (first && typeof first === "object" && "local_time" in first) {
    return (raw as Array<{ local_time: string }>).map((s) => s.local_time);
  }

  // Caso 3: ISO strings -> convertir a HH:mm local
  if (typeof first === "string") {
    return (raw as string[]).map((iso) => toHHmmLocal(iso));
  }

  // Caso 4: objetos con 'utc' -> convertir a HH:mm local
  if (first && typeof first === "object" && "utc" in first) {
    return (raw as Array<{ utc: string }>).map((s) => toHHmmLocal(s.utc));
  }

  return [];
}

// =================================================================
// --- INICIO DEL COMPONENTE ---
// =================================================================
const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  selectedEvent,
  defaultDate,
}) => {
  const dispatch: any = useDispatch();
  const { clients = [], services = [] } =
    useSelector((state: any) => state.calendar || state.Calendar || {}) || {};

  // ================== ESTADOS ==================
  const [showNewClientForm, setShowNewClientForm] = useState<boolean>(false);
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);

  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState<boolean>(false);

  const [availableStylists, setAvailableStylists] = useState<Stylist[]>([]);
  const [isLoadingStylists, setIsLoadingStylists] = useState<boolean>(false);

  const [availableStylistsRows, setAvailableStylistsRows] = useState<
    Record<number, Stylist[]>
  >({});
  const [isLoadingStylistsRows, setIsLoadingStylistsRows] = useState<
    Record<number, boolean>
  >({});

  const [isSuggestingMain, setIsSuggestingMain] = useState<boolean>(false);
  const [isSuggestingRow, setIsSuggestingRow] = useState<Record<number, boolean>>(
    {}
  );

  // === Flags para NO limpiar campos en la primera carga de edición ===
  const firstLoadEditRef = useRef<boolean>(false);
  const isEditMode = !!selectedEvent;

  // --- FORMIK ---
  const validation = useFormik<AppointmentFormValues>({
    enableReinitialize: true,
    validationSchema: Yup.object({
      service_id: Yup.string().required("Seleccione un servicio."),
      date: Yup.mixed().required("Seleccione una fecha."),
      start_time: Yup.string().required("Seleccione un horario."),
      stylist_id: Yup.string().required("Seleccione un estilista."),
      client_id: Yup.string().when([], {
        is: () => !showNewClientForm && !selectedEvent,
        then: (schema: any) => schema.required("Seleccione un cliente."),
        otherwise: (schema: any) => schema.notRequired(),
      }),
      newClientFirstName: Yup.string().when([], {
        is: () => showNewClientForm,
        then: (schema: any) => schema.required("El nombre es requerido."),
        otherwise: (schema: any) => schema.notRequired(),
      }),
      newClientEmail: Yup.string().when([], {
        is: () => showNewClientForm,
        then: (schema: any) =>
          schema.email("Email inválido").required("El email es requerido."),
        otherwise: (schema: any) => schema.notRequired(),
      }),
    }),
    initialValues: {
      client_id: "",
      service_id: "",
      stylist_id: "",
      date: "",
      start_time: "",
      newClientFirstName: "",
      newClientLastName: "",
      newClientPhone: "",
      newClientEmail: "",
    },
    onSubmit: async (values, { setSubmitting }) => {
      setSubmitting(true);
      try {
        const dateObj = new Date(values.date as any);
        const [hours, minutes] = values.start_time.split(":").map(Number);
        dateObj.setHours(hours, minutes, 0, 0);
        const utcDateTimeString = dateObj.toISOString();

        let finalClientId = values.client_id;
        if (showNewClientForm) {
          const newClient = await dispatch(
            onCreateNewClient({
              first_name: values.newClientFirstName,
              last_name: values.newClientLastName,
              phone: values.newClientPhone,
              email: values.newClientEmail,
            })
          );
          finalClientId = newClient.id;
        }
        if (!finalClientId && !selectedEvent)
          throw new Error("ID de cliente no válido.");

        if (selectedEvent) {
          await dispatch(
            onUpdateAppointment({
              id: selectedEvent.id,
              client_id: selectedEvent.client_id,
              service_id: values.service_id,
              stylist_id: values.stylist_id,
              start_time: utcDateTimeString,
            })
          );
        } else {
          const allAppointments = [
            {
              service_id: values.service_id,
              stylist_id: values.stylist_id,
              start_time: utcDateTimeString,
            },
            ...extraRows
              .filter((r) => r.service_id && r.stylist_id)
              .map((r) => ({ ...r, start_time: utcDateTimeString })),
          ];

          await dispatch(
            onCreateAppointmentsBatch({
              client_id: finalClientId,
              appointments: allAppointments,
            })
          );
        }
        onClose();
      } catch (error: any) {
        toast.error(error.message || "No se pudo completar la operación.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  // --- Reset / Preparación del modal ---
  useEffect(() => {
    const resetState = () => {
      validation.resetForm();
      setShowNewClientForm(false);
      setExtraRows([]);
      setTimeSlots([]);
      setAvailableStylists([]);
      setAvailableStylistsRows({});
    };

    if (isOpen) {
      if (selectedEvent) {
        // bandera para NO limpiar hora/estilista en la primera pasada
        firstLoadEditRef.current = true;
        const { client_id, service_id, stylist_id, start_time } = selectedEvent;
        const startTimeDate = new Date(start_time);
        validation.setValues({
          ...validation.initialValues,
          client_id: String(client_id || ""),
          service_id: String(service_id || ""),
          stylist_id: String(stylist_id || ""),
          date: startTimeDate,
          start_time: toHHmmLocal(start_time),
        });
      } else if (defaultDate) {
        validation.setFieldValue("date", defaultDate);
      }
    } else {
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedEvent, defaultDate]);

  // --- Slots por servicio/fecha ---
  useEffect(() => {
    const { service_id, date } = validation.values;

    // Solo limpiar la hora si NO estamos en la primera carga de edición
    if (!(isEditMode && firstLoadEditRef.current)) {
      validation.setFieldValue("start_time", "");
    }

    if (service_id && date) {
      setIsLoadingTimeSlots(true);
      const dateStr = toYyyyMmDd(date);
      dispatch(fetchTenantSlots(dateStr, service_id))
        .then((payload: any) => {
          // 🔧 FIX: normalizamos SIEMPRE a ["HH:mm"]
          const fetched = normalizeSlotsPayload(payload);

          // Garantiza que el horario actual aparezca aunque ya no esté disponible
          const current = validation.values.start_time;
          const merged =
            current && !fetched.includes(current) ? [current, ...fetched] : fetched;

          setTimeSlots(merged);
        })
        .catch(() => setTimeSlots([]))
        .finally(() => {
          setIsLoadingTimeSlots(false);
          // Después de la primera pasada en edición, permitimos limpiar normalmente
          if (firstLoadEditRef.current) firstLoadEditRef.current = false;
        });
    } else {
      setTimeSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.values.service_id, validation.values.date, dispatch]);

  // --- Estilistas disponibles por servicio/fecha/hora ---
  useEffect(() => {
    const { service_id, date, start_time } = validation.values;

    // Solo limpiar el estilista si NO estamos en la primera carga de edición
    if (!(isEditMode && firstLoadEditRef.current)) {
      validation.setFieldValue("stylist_id", "");
    }

    if (service_id && date && start_time) {
      setIsLoadingStylists(true);
      const dateStr = toYyyyMmDd(date);
      dispatch(fetchAvailableStylists(dateStr, start_time, service_id))
        .then((stylists: Stylist[]) => {
          // Garantiza que el estilista actual aparezca aunque no esté disponible
          const currentId = validation.values.stylist_id;
          const hasCurrent = stylists.some(
            (s) => String(s.id) === String(currentId)
          );
          const merged = hasCurrent
            ? stylists
            : currentId
            ? [
                {
                  id: currentId,
                  first_name: currentStylistLabel || "Actual",
                  last_name: currentStylistLabel ? "" : "(asignado)",
                },
                ...stylists,
              ]
            : stylists;
          setAvailableStylists(merged);
        })
        .catch(() => setAvailableStylists([]))
        .finally(() => {
          setIsLoadingStylists(false);
          if (firstLoadEditRef.current) firstLoadEditRef.current = false;
        });
    } else {
      setAvailableStylists([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    validation.values.service_id,
    validation.values.date,
    validation.values.start_time,
    dispatch,
  ]);

  // --- Cambio de servicio en filas extra ---
  const handleExtraRowServiceChange = (rowIndex: number, newServiceId: string) => {
    setExtraRows((rows) =>
      rows.map((row, i) =>
        i === rowIndex ? { service_id: newServiceId, stylist_id: "" } : row
      )
    );
    setAvailableStylistsRows((prev) => ({ ...prev, [rowIndex]: [] }));
  };

  // --- Estilistas disponibles por fila extra ---
  const extraRowsServiceIdsKey = extraRows.map((r) => r.service_id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- extraRowsServiceIdsKey ya refleja extraRows; validation.values se usa de forma controlada
  useEffect(() => {
    const { date, start_time } = validation.values;
    if (date && start_time) {
      extraRows.forEach((row, index) => {
        if (row.service_id) {
          setIsLoadingStylistsRows((prev) => ({ ...prev, [index]: true }));
          const dateStr = toYyyyMmDd(date);
          dispatch(fetchAvailableStylists(dateStr, start_time, row.service_id))
            .then((stylists: Stylist[]) => {
              setAvailableStylistsRows((prev) => ({ ...prev, [index]: stylists }));
            })
            .finally(() =>
              setIsLoadingStylistsRows((prev) => ({ ...prev, [index]: false }))
            );
        }
      });
    }
  }, [
    validation.values.date,
    validation.values.start_time,
    extraRowsServiceIdsKey,
    dispatch,
  ]);

  // --- Digiturno (principal) ---
  const isStylistUsedElsewhere = (
    stylistId: string | number,
    selfIndex?: number
  ) => {
    const idStr = String(stylistId);
    if (selfIndex === undefined) {
      // Fila principal vs extras
      return extraRows.some((r) => String(r.stylist_id) === idStr);
    }
    // Fila extra vs principal
    if (String(validation.values.stylist_id) === idStr) return true;
    // Fila extra vs otras extras
    return extraRows.some((r, i) => i !== selfIndex && String(r.stylist_id) === idStr);
  };

  const handleSuggestMain = async () => {
    const { service_id, date, start_time } = validation.values;
    if (!service_id || !date || !start_time) {
      toast.info("Selecciona servicio, fecha y hora antes de usar Digiturno.");
      return;
    }
    setIsSuggestingMain(true);
    try {
      const dateStr = toYyyyMmDd(date);
      const stylists: Stylist[] = await dispatch(
        fetchAvailableStylists(dateStr, start_time, service_id)
      );
      const nextStylist = stylists.find((s) => !isStylistUsedElsewhere(s.id));
      if (nextStylist) {
        validation.setFieldValue("stylist_id", String(nextStylist.id));
        toast.success(`Digiturno asignó a: ${nextStylist.first_name || ""}`);
      } else {
        toast.error(
          "No hay estilistas disponibles que no estén ya asignados en otro servicio."
        );
      }
    } finally {
      setIsSuggestingMain(false);
    }
  };

  // --- Digiturno (fila extra) ---
  const handleSuggestForRow = async (rowIndex: number) => {
    const { date, start_time } = validation.values;
    const { service_id } = extraRows[rowIndex] || {};
    if (!service_id || !date || !start_time) {
      toast.info(
        "Selecciona servicio, fecha y hora antes de usar Digiturno en esta fila."
      );
      return;
    }
    setIsSuggestingRow((p) => ({ ...p, [rowIndex]: true }));
    try {
      const dateStr = toYyyyMmDd(date);
      const stylists: Stylist[] = await dispatch(
        fetchAvailableStylists(dateStr, start_time, service_id)
      );
      const nextStylist = stylists.find(
        (s) => !isStylistUsedElsewhere(s.id, rowIndex)
      );
      if (nextStylist) {
        setExtraRows((rows) =>
          rows.map((r, i) =>
            i === rowIndex ? { ...r, stylist_id: String(nextStylist.id) } : r
          )
        );
        toast.success(`Digiturno asignó a: ${nextStylist.first_name || ""}`);
      } else {
        toast.error("No hay estilistas disponibles para esta fila.");
      }
    } finally {
      setIsSuggestingRow((p) => ({ ...p, [rowIndex]: false }));
    }
  };

  // --- Helpers UI ---
  const addExtraRow = () =>
    setExtraRows((prev) => [...prev, { service_id: "", stylist_id: "" }]);

  const removeExtraRow = (idx: number) =>
    setExtraRows((prev) => prev.filter((_, i) => i !== idx));

  const changeExtraRow = (
    idx: number,
    field: keyof ExtraRow,
    value: string
  ) => {
    if (field === "service_id") {
      handleExtraRowServiceChange(idx, value);
    } else {
      setExtraRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
      );
    }
  };

  const canSubmit = useMemo(
    () => validation.isValid && !validation.isSubmitting,
    [validation.isValid, validation.isSubmitting]
  );

  // === Fallbacks por si la opción seleccionada no existe aún en la lista ===
  const clientMissing =
    !!validation.values.client_id &&
    !clients.some((c: any) => String(c.id) === String(validation.values.client_id));
  const timeMissing =
    !!validation.values.start_time &&
    !timeSlots.includes(validation.values.start_time);
  const stylistMissing =
    !!validation.values.stylist_id &&
    !availableStylists.some(
      (s) => String(s.id) === String(validation.values.stylist_id)
    );

  // Nombre del estilista actual (si no está en la lista)
  const currentStylistLabel = (() => {
    const id = validation.values.stylist_id;
    if (!id) return "";
    // 1) Intentar leer desde selectedEvent con claves comunes
    const ev = selectedEvent || {};
    const f = ev.stylist_first_name || ev.stylist?.first_name || ev.first_name;
    const l = ev.stylist_last_name || ev.stylist?.last_name || ev.last_name;
    if (f || l) return `${f || ""} ${l || ""}`.trim();
    // 2) Intentar deducir desde availableStylists (por si llegó entre renders)
    const found = availableStylists.find((s) => String(s.id) === String(id));
    if (found) return `${found.first_name || ""} ${found.last_name || ""}`.trim();
    // 3) Último recurso: mostrar ID
    return `ID ${id}`;
  })();

  // --- RENDER ---
  return (
    <Modal isOpen={isOpen} toggle={onClose} centered size="lg">
      <ModalHeader toggle={onClose} tag="h5" className="p-3 bg-light">
        {isEditMode ? "Editar Cita" : "Agendar Cita"}
      </ModalHeader>
      <ModalBody>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            validation.handleSubmit();
          }}
          className="text-start"
        >
          <Row className="g-3">
            {/* ================= Cliente ================= */}
            <Col xs={12}>
              {showNewClientForm ? (
                <div className="border rounded p-3">
                  <h6 className="mb-3">Datos del Nuevo Cliente</h6>
                  <Row className="g-3">
                    <Col md={6}>
                      <FormGroup className="mb-0">
                        <Label>Nombre*</Label>
                        <Input
                          name="newClientFirstName"
                          onChange={validation.handleChange}
                          value={validation.values.newClientFirstName}
                          invalid={!!(
                            validation.touched.newClientFirstName &&
                            validation.errors.newClientFirstName
                          )}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup className="mb-0">
                        <Label>Apellido</Label>
                        <Input
                          name="newClientLastName"
                          onChange={validation.handleChange}
                          value={validation.values.newClientLastName}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup className="mb-0">
                        <Label>Email*</Label>
                        <Input
                          name="newClientEmail"
                          type="email"
                          onChange={validation.handleChange}
                          value={validation.values.newClientEmail}
                          invalid={!!(
                            validation.touched.newClientEmail &&
                            validation.errors.newClientEmail
                          )}
                        />
                      </FormGroup>
                    </Col>
                    <Col md={6}>
                      <FormGroup className="mb-0">
                        <Label>Teléfono</Label>
                        <Input
                          name="newClientPhone"
                          onChange={validation.handleChange}
                          value={validation.values.newClientPhone}
                        />
                      </FormGroup>
                    </Col>
                  </Row>
                  <div className="mt-2">
                    <Button
                      color="link"
                      size="sm"
                      onClick={() => setShowNewClientForm(false)}
                      className="ps-0"
                    >
                      O seleccionar cliente existente
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <FormGroup className="mb-0">
                    <Label>Cliente*</Label>
                    <Row className="g-2 align-items-end">
                      <Col md={isEditMode ? 12 : 9}>
                        <Input
                          type="select"
                          name="client_id"
                          onChange={validation.handleChange}
                          value={validation.values.client_id}
                          disabled={isEditMode} // Deshabilita el select en modo edición
                        >
                          <option value="">
                            {clients.length ? "Seleccione…" : "Cargando…"}
                          </option>
                          {clientMissing && (
                            <option value={validation.values.client_id}>
                              Cliente actual (ID {validation.values.client_id})
                            </option>
                          )}
                          {clients.map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.first_name} {c.last_name}
                            </option>
                          ))}
                        </Input>
                      </Col>
                      {!isEditMode && (
                        <Col md="auto">
                          <Button
                            color="secondary"
                            outline
                            onClick={() => setShowNewClientForm(true)}
                          >
                            Crear nuevo cliente
                          </Button>
                        </Col>
                      )}
                    </Row>
                  </FormGroup>
                </>
              )}
            </Col>

            {/* ================= Servicio (ancho completo) ================= */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label>Servicio*</Label>
                <Input
                  type="select"
                  name="service_id"
                  onChange={validation.handleChange}
                  value={validation.values.service_id}
                  disabled={!services?.length}
                >
                  <option value="">
                    {services?.length
                      ? "Seleccione un servicio..."
                      : "Cargando servicios..."}
                  </option>
                  {services?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </Col>

            {/* ================= Fecha y Hora (lado a lado) ================= */}
            <Col md={6}>
              <FormGroup className="mb-0">
                <Label>Fecha*</Label>
                <Flatpickr
                  className="form-control"
                  value={validation.values.date as any}
                  onChange={([d]) => validation.setFieldValue("date", d)}
                  options={{
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "F j, Y",
                    // Permitimos mostrar/editar fechas pasadas cuando se edita
                    minDate: isEditMode ? undefined : "today",
                  }}
                />
              </FormGroup>
            </Col>
            <Col md={6}>
              <FormGroup className="mb-0">
                <Label>Hora*</Label>
                <Input
                  type="select"
                  name="start_time"
                  onChange={validation.handleChange}
                  value={validation.values.start_time}
                  disabled={isLoadingTimeSlots || !validation.values.date}
                >
                  <option value="">
                    {isLoadingTimeSlots
                      ? "Buscando horarios..."
                      : !validation.values.date
                      ? "Seleccione fecha..."
                      : "Seleccione horario..."}
                  </option>
                  {timeMissing && (
                    <option value={validation.values.start_time}>
                      {validation.values.start_time} (actual)
                    </option>
                  )}
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </Input>
              </FormGroup>
            </Col>

            {/* ================= Estilista + Digiturno ================= */}
            <Col xs={12}>
              <FormGroup className="mb-0">
                <Label>Estilista*</Label>
                <div className="d-flex gap-2">
                  <Input
                    type="select"
                    name="stylist_id"
                    onChange={validation.handleChange}
                    value={validation.values.stylist_id}
                    disabled={isLoadingStylists || !validation.values.start_time}
                  >
                    <option value="">
                      {isLoadingStylists ? "Buscando disponibles..." : "Seleccione..."}
                    </option>
                    {stylistMissing && validation.values.stylist_id && (
                      <option value={validation.values.stylist_id}>
                        {currentStylistLabel || `Estilista actual (ID ${validation.values.stylist_id})`}
                      </option>
                    )}
                    {availableStylists.map((stylist) => (
                      <option
                        key={stylist.id}
                        value={stylist.id}
                      >
                        {stylist.first_name} {stylist.last_name}
                      </option>
                    ))}
                  </Input>
                  <Button
                    color="info"
                    outline
                    onClick={handleSuggestMain}
                    title="Digiturno (sugerir estilista del turno)"
                    disabled={isSuggestingMain || !validation.values.start_time}
                  >
                    {isSuggestingMain ? <Spinner size="sm" /> : "Digiturno"}
                  </Button>
                </div>
              </FormGroup>
            </Col>

            {/* ================= Filas Extra (multi-servicio) ================= */}
            {!isEditMode && (
              <>
                {extraRows.map((row, idx) => {
                  const stylistsForThisRow = availableStylistsRows[idx] || [];
                  const isLoadingThisRow = isLoadingStylistsRows[idx];
                  const isSuggestingThisRow = isSuggestingRow[idx];
                  return (
                    <Col xs={12} key={`extra-row-${idx}`} className="border rounded p-3">
                      <Row className="g-2 align-items-end">
                        <Col sm={6}>
                          <FormGroup className="mb-0">
                            <Label>Servicio #{idx + 2}</Label>
                            <Input
                              type="select"
                              value={row.service_id}
                              onChange={(e) =>
                                changeExtraRow(idx, "service_id", e.target.value)
                              }
                            >
                              <option value="">Seleccione...</option>
                              {services.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </Input>
                          </FormGroup>
                        </Col>
                        <Col sm={6}>
                          <FormGroup className="mb-0">
                            <Label>Estilista #{idx + 2}</Label>
                            <div className="d-flex gap-2">
                              <Input
                                type="select"
                                value={row.stylist_id}
                                onChange={(e) =>
                                  changeExtraRow(idx, "stylist_id", e.target.value)
                                }
                                disabled={isLoadingThisRow || !row.service_id}
                              >
                                <option value="">
                                  {isLoadingThisRow ? "Buscando..." : "Seleccione..."}
                                </option>
                                {stylistsForThisRow.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.first_name} {s.last_name}
                                  </option>
                                ))}
                              </Input>
                              <Button
                                color="info"
                                outline
                                onClick={() => handleSuggestForRow(idx)}
                                disabled={isSuggestingThisRow || !row.service_id}
                                title="Digiturno para esta fila"
                              >
                                {isSuggestingThisRow ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <i className="ri-magic-line"></i>
                                )}
                              </Button>
                              <Button
                                color="danger"
                                outline
                                onClick={() => removeExtraRow(idx)}
                                title="Eliminar servicio"
                              >
                                <i className="ri-delete-bin-6-line"></i>
                              </Button>
                            </div>
                          </FormGroup>
                        </Col>
                      </Row>
                    </Col>
                  );
                })}

                <Col xs={12}>
                  <Button color="secondary" outline onClick={addExtraRow}>
                    Añadir otro servicio
                  </Button>
                </Col>
              </>
            )}
          </Row>

          <div className="hstack gap-2 justify-content-end mt-3">
            <Button type="button" color="light" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" color="success" disabled={!canSubmit}>
              {validation.isSubmitting ? (
                <Spinner size="sm" />
              ) : isEditMode ? (
                "Guardar Cambios"
              ) : (
                "Agendar Cita"
              )}
            </Button>
          </div>
        </Form>
      </ModalBody>
    </Modal>
  );
};

export default AppointmentModal;
