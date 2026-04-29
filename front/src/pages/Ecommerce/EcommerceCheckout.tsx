// Archivo: src/pages/Ecommerce/EcommerceCheckout.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Container, Row, Col, Card, CardBody, Label, Input, Button, Badge,
  Spinner, UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem,
  Modal, ModalHeader, ModalBody, ModalFooter
} from "reactstrap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { getCalendarData } from "../../slices/thunks";
import { env } from '../../env';

type LocationState = { clientId?: string | number; appointmentIds?: (string | number)[]; };
type SummaryItem = {
  id: string | number;
  name: string;
  stylist: string;
  time: string;
  price: number;
  total: number;
  status: string;
};

const API_BASE = (env.API_URL || "").replace(/\/$/, "");

const statusColor = (s: string) =>
  s === "checked_in" ? "info" :
  s === "checked_out" ? "warning" :
  s === "completed" ? "success" :
  s === "cancelled" ? "danger" : "secondary";

const statusLabel: Record<string, string> = {
  scheduled: "Agendado",
  rescheduled: "Reagendado",
  checked_in: "Check-in",
  checked_out: "Finalizado",
  completed: "Pagado",
  cancelled: "Cancelado",
};

function parseJwt(token?: string | null): any {
  if (!token) return {};
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded?.user || decoded;
  } catch {
    return {};
  }
}

const EcommerceCheckout: React.FC = () => {
  const dispatch: any = useDispatch();
  const navigate = useNavigate();

  const { state } = useLocation() as { state?: LocationState };
  const [params] = useSearchParams();
  const clientIdFromQuery = params.get("client_id");
  const clientId = (state?.clientId ?? clientIdFromQuery) as string | number | null;

  const { events, clients } = useSelector((s: any) => s.Calendar);

  const tokenFromStore = useSelector(
    (s: any) => s?.Profile?.user?.token ?? s?.Login?.user?.token ?? s?.Auth?.user?.token
  ) as string | undefined;
  const token =
    tokenFromStore || localStorage.getItem("authToken") || localStorage.getItem("token") || "";

  useMemo(() => parseJwt(token), [token]);

  const currentClient = useMemo(() => {
    if (!clientId || !Array.isArray(clients)) return null;
    return clients.find((c: any) => String(c.id) === String(clientId)) || null;
  }, [clientId, clients]);

  // Personal Info
  const [fullName, setFullName] = useState("");
  useEffect(() => {
    if (currentClient) {
      const fn = currentClient.first_name ?? "";
      const ln = currentClient.last_name ?? "";
      setFullName([fn, ln].filter(Boolean).join(" "));
    } else {
      setFullName("");
    }
  }, [currentClient]);

  // Pagos
  const [cashText, setCashText] = useState<string>("");
  const [useCard, setUseCard] = useState<boolean>(false);
  const [cardVoucher, setCardVoucher] = useState<string>("");
  const [cardText, setCardText] = useState<string>("");

  const sanitizeMoney = (raw: string) => {
    const only = raw.replace(/[^0-9.]/g, "");
    const parts = only.split(".");
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : only;
    return normalized.replace(/^0+(?=\d)/, "");
  };

  const cashAmount = parseFloat(cashText || "0") || 0;
  const cardAmount = parseFloat(cardText || "0") || 0;

  // Filtro de citas del cliente y orden
  const wantedIds = state?.appointmentIds?.map(String);

  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const effectiveStatus = (id: string | number, serverStatus: string) =>
    localStatuses[String(id)] ?? serverStatus;

  const allItems: SummaryItem[] = useMemo(() => {
    if (!clientId || !Array.isArray(events)) return [];
    return events
      .filter((ev: any) => {
        const ep = ev.extendedProps || {};
        const evClientId = ep.client_id ?? ep.clientId;
        if (String(evClientId) !== String(clientId)) return false;
        if (wantedIds && !wantedIds.includes(String(ev.id))) return false;
        return true;
      })
      .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map((ev: any) => {
        const ep = ev.extendedProps || {};
        const price = Number(ep.price ?? ep.amount ?? ep.service_price ?? 0) || 0;
        return {
          id: ev.id,
          name: ep.service_name ?? "Servicio",
          stylist: ep.stylist_first_name ?? "",
          time: new Date(ep.start_time ?? ev.start).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          price,
          total: price,
          status: ep.status ?? "scheduled",
        };
      });
  }, [clientId, events, wantedIds]);

  // Solo cuentan las finalizadas (checked_out). Si se cancela o reagenda, se excluyen.
  const readyForPayment = allItems.filter(i => effectiveStatus(i.id, i.status) === "checked_out");
  const total = readyForPayment.reduce((acc, it) => acc + it.total, 0);

  // API helper
  const api = async (path: string, method: string, body?: any) => {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `${res.status} ${res.statusText}`);
    }
    if (res.status === 204) return {};
    try { return await res.json(); } catch { return {}; }
  };

  const checkIn   = (id: string | number) => api(`/appointments/${id}/checkin`, "PATCH");
  const checkOut  = (id: string | number) => api(`/appointments/${id}/checkout`, "PATCH");
  const setStatus = (id: string | number, status: string) => api(`/appointments/${id}/status`, "PATCH", { status });

  // Reagendar (modal)
  const [resModalOpen, setResModalOpen] = useState(false);
  const [resItem, setResItem] = useState<SummaryItem | null>(null);
  const [resDateTime, setResDateTime] = useState<string>("");

  const openReschedule = (item: SummaryItem) => {
    setResItem(item);
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const isoLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setResDateTime(isoLocal);
    setResModalOpen(true);
  };

  const submitReschedule = async () => {
    if (!resItem || !resDateTime) return;
    const id = resItem.id;

    setUpdating(prev => ({ ...prev, [String(id)]: true }));
    try {
      // 1) Endpoint específico (si existe)
      try {
        await api(`/appointments/${id}/reschedule`, "PATCH", { start_time: new Date(resDateTime).toISOString() });
      } catch {
        // 2) PATCH genérico a appointments
        try {
          await api(`/appointments/${id}`, "PATCH", { start_time: new Date(resDateTime).toISOString() });
        } catch {
          // 3) Fallback: solo estado
          await setStatus(id, "rescheduled");
        }
      }

      setLocalStatuses(prev => ({ ...prev, [String(id)]: "rescheduled" })); // excluye del total
      await dispatch(getCalendarData());
      setLocalStatuses(prev => { const { [String(id)]: _, ...rest } = prev; return rest; });
      setResModalOpen(false);
      setResItem(null);
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'No se pudo reagendar.', confirmButtonColor: '#1A1D1F' });
    } finally {
      setUpdating(prev => ({ ...prev, [String(id)]: false }));
    }
  };

  // Spinners y helpers
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const refreshCalendar = async () => { await dispatch(getCalendarData()); };
  const setLocalStatus = (id: string | number, status: string) => {
    setLocalStatuses(prev => ({ ...prev, [String(id)]: status }));
  };

  const handleAdvance = async (item: SummaryItem) => {
    const id = item.id;
    const cur = effectiveStatus(id, item.status);
    setUpdating(prev => ({ ...prev, [String(id)]: true }));
    try {
      if (cur === "scheduled") {
        setLocalStatus(id, "checked_in");
        await checkIn(id);
      } else if (cur === "checked_in") {
        setLocalStatus(id, "checked_out");
        await checkOut(id);
      } else {
        return;
      }
      await refreshCalendar();
      setLocalStatuses(prev => { const { [String(id)]: _, ...rest } = prev; return rest; });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'No se pudo cambiar el estado.', confirmButtonColor: '#1A1D1F' });
      setLocalStatuses(prev => { const { [String(id)]: _, ...rest } = prev; return rest; });
    } finally {
      setUpdating(prev => ({ ...prev, [String(id)]: false }));
    }
  };

  const handleCancel = async (item: SummaryItem) => {
    const prevStatus = effectiveStatus(item.id, item.status);
    setUpdating(prev => ({ ...prev, [String(item.id)]: true }));
    setLocalStatus(item.id, "cancelled");
    try {
      await setStatus(item.id, "cancelled");
      await refreshCalendar();
    } catch {
      setLocalStatus(item.id, prevStatus);
      Swal.fire({ icon: 'error', title: 'No se pudo cancelar.', confirmButtonColor: '#1A1D1F' });
    } finally {
      setUpdating(prev => ({ ...prev, [String(item.id)]: false }));
    }
  };

  // -------- Pago mixto: distribuye tarjeta primero y luego efectivo ----------
  const [paymentSuccess, setPaymentSuccess] = useState<null | { invoiceId: string }>(null);

  const createPayment = (payload: { appointment_id: string | number; amount: string; payment_method: string; }) =>
    api(`/payments`, "POST", payload);

  const handlePayNow = async () => {
    if (!clientId || readyForPayment.length === 0) return;

    const paidTotal = cashAmount + (useCard ? cardAmount : 0);
    if (paidTotal < total) {
      Swal.fire({ icon: 'warning', title: `Falta por pagar $${(total - paidTotal).toFixed(2)}.`, confirmButtonColor: '#1A1D1F' });
      return;
    }

    let remainingCard = useCard ? Math.max(0, cardAmount) : 0;
    let remainingCash = Math.max(0, cashAmount);

    try {
      for (const item of readyForPayment) {
        let remainingForItem = item.total;

        // 1) Tarjeta primero
        if (useCard && remainingCard > 0 && remainingForItem > 0) {
          const cardPay = Math.min(remainingCard, remainingForItem);
          if (cardPay > 0) {
            await createPayment({
              appointment_id: item.id,
              amount: cardPay.toFixed(2),
              payment_method: "credit_card",
            });
            remainingCard -= cardPay;
            remainingForItem -= cardPay;
          }
        }

        // 2) Efectivo después
        if (remainingCash > 0 && remainingForItem > 0) {
          const cashPay = Math.min(remainingCash, remainingForItem);
          if (cashPay > 0) {
            await createPayment({
              appointment_id: item.id,
              amount: cashPay.toFixed(2),
              payment_method: "cash",
            });
            remainingCash -= cashPay;
            remainingForItem -= cashPay;
          }
        }

        if (remainingForItem > 0.0001) {
          throw new Error("El monto total aportado no cubre el total de las citas.");
        }

        setLocalStatus(item.id, "completed"); // optimista
      }

      await refreshCalendar();
      setLocalStatuses({});
      const change = paidTotal - total;
      setPaymentSuccess({ invoiceId: `INV-${Date.now()}` });
      if (change > 0) {
        Swal.fire({ icon: 'success', title: `Pago exitoso. Cambio: $${change.toFixed(2)}`, confirmButtonColor: '#1A1D1F' });
      }
    } catch (e: any) {
      console.error(e);
      Swal.fire({ icon: 'error', title: 'No se pudo completar el pago.', text: e?.message ?? '', confirmButtonColor: '#1A1D1F' });
    }
  };

  document.title = paymentSuccess ? "Pago Completado" : "Caja | Sistema de Peluquerías";

  // ------- UI -------
  const paidTotal = cashAmount + (useCard ? cardAmount : 0);
  const disablePay =
    !clientId ||
    readyForPayment.length === 0 ||
    paidTotal < total; // requiere que la suma cubra el total

  return (
    <div className="page-content">
      <Container fluid>
        {/* Header */}
        <Row className="mb-3">
          <Col>
            <div className="d-flex align-items-center justify-content-between border-bottom" style={{ padding: "8px 0" }}>
              <div className="d-flex align-items-center gap-2">
                <Button
                  color="light"
                  className="d-inline-flex align-items-center shadow-sm"
                  style={{ width: 36, height: 36, padding: 0, justifyContent: "center", position: "relative", zIndex: 10 }}
                  onClick={() => navigate("/dashboard")}
                  title="Volver al Dashboard"
                >
                  <i className="ri-arrow-left-line"></i>
                </Button>
                <h4 className="mb-0">CAJA</h4>
              </div>
              <div className="text-muted small">Ecommerce <span className="mx-1">›</span> Caja</div>
            </div>
          </Col>
        </Row>

        {paymentSuccess ? (
          <Row>
            <Col xl={{ size: 8, offset: 2 }}>
              <Card>
                <CardBody className="text-center py-5">
                  <i className="bx bx-party display-4 text-success mb-4"></i>
                  <h5>Thank you ! Your Payment is Completed !</h5>
                  <p className="text-muted">You will receive a receipt email with details of your payment.</p>
                  <h3 className="fw-semibold">
                    Invoice ID: <span className="text-decoration-underline">{paymentSuccess.invoiceId}</span>
                  </h3>
                  <div className="mt-4">
                    <Button color="primary" onClick={() => navigate("/dashboard")}>Volver al Dashboard</Button>
                  </div>
                </CardBody>
              </Card>
            </Col>
          </Row>
        ) : (
          <Row>
            {/* Centro */}
            <Col xl="7">
              <Card>
                <CardBody>
                  {/* 1) Personal Info */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center mb-3">
                      <span className="me-2">1)</span><h5 className="mb-0">Personal Info</h5>
                    </div>
                    <Row>
                      <Col sm={12}>
                        <Label htmlFor="fullName" className="form-label">Full Name</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellido" />
                      </Col>
                    </Row>
                  </div>

                  {/* 2) Payment Methods */}
                  <div className="mb-4">
                    <div className="d-flex align-items-center mb-3">
                      <span className="me-2">2)</span><h5 className="mb-0">Payment Methods</h5>
                    </div>

                    <Card className="p-3 border shadow-none">
                      <Row className="gy-3">
                        {/* Efectivo */}
                        <Col md={6}>
                          <h6 className="mb-2">Paga con efectivo</h6>
                          <Label className="form-label">Ingresa el monto</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={cashText}
                            onChange={(e) => setCashText(sanitizeMoney(e.target.value))}
                          />
                        </Col>

                        {/* Tarjeta */}
                        <Col md={6}>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="mb-0">Paga con tarjeta</h6>
                            <div className="form-check form-switch m-0">
                              <Input
                                className="form-check-input"
                                type="checkbox"
                                id="useCard"
                                checked={useCard}
                                onChange={(e) => setUseCard(e.target.checked)}
                              />
                            </div>
                          </div>

                          <Label className="form-label">Nº de voucher</Label>
                          <Input
                            value={cardVoucher}
                            onChange={(e) => setCardVoucher(e.target.value)}
                            placeholder="Ej: 123456"
                            disabled={!useCard}
                          />
                          <Label className="form-label mt-2">Monto tarjeta</Label>
                          <Input
                            inputMode="decimal"
                            placeholder="0"
                            value={cardText}
                            onChange={(e) => setCardText(sanitizeMoney(e.target.value))}
                            disabled={!useCard}
                          />
                          <small className="text-muted d-block mt-1">Puedes combinar tarjeta + efectivo. El total debe cubrir el monto a pagar.</small>
                        </Col>
                      </Row>

                      {/* Calculadora */}
                      <div className="mt-3 p-3 bg-light rounded">
                        <div className="d-flex justify-content-between">
                          <span>Total a pagar:</span>
                          <strong>${total.toFixed(2)}</strong>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Pagado (efectivo + tarjeta):</span>
                          <strong>${paidTotal.toFixed(2)}</strong>
                        </div>
                        {paidTotal - total < 0 && (
                          <div className="d-flex justify-content-between text-danger">
                            <span>Falta:</span>
                            <strong>${(total - paidTotal).toFixed(2)}</strong>
                          </div>
                        )}
                        {paidTotal - total > 0 && (
                          <div className="d-flex justify-content-between text-success">
                            <span>Cambio:</span>
                            <strong>${(paidTotal - total).toFixed(2)}</strong>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                </CardBody>
              </Card>
            </Col>

            {/* Derecha */}
            <Col xl="5">
              <Card>
                <CardBody>
                  <div className="d-flex align-items-center mb-3">
                    <h5 className="card-title mb-0">Order Summary</h5>
                    <Badge color="dark" pill className="ms-2">{allItems.length}</Badge>
                  </div>

                  <div className="table-responsive table-card">
                    <table className="table table-borderless align-middle mb-0">
                      <thead className="table-light text-muted">
                        <tr>
                          <th style={{ width: 160 }}>Estado</th>
                          <th>Servicio</th>
                          <th className="text-end">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems.length === 0 && (
                          <tr>
                            <td colSpan={3} className="text-center text-muted">
                              {clientId ? "No hay servicios para este cliente." : "Abre el Checkout desde la cola de pagos."}
                            </td>
                          </tr>
                        )}

                        {allItems.map((item) => {
                          const cur = effectiveStatus(item.id, item.status);
                          const color = statusColor(cur);
                          const label = statusLabel[cur] ?? cur;
                          const isBusy = !!updating[String(item.id)];
                          const canAdvance = cur === "scheduled" || cur === "checked_in";
                          const advanceTooltip =
                            cur === "scheduled" ? "Hacer Check-in" :
                            cur === "checked_in" ? "Finalizar (Check-out)" :
                            "Estado final / pagar";

                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <Button
                                    size="sm"
                                    color={color}
                                    outline={!canAdvance}
                                    disabled={!canAdvance || isBusy}
                                    onClick={() => handleAdvance(item)}
                                    title={advanceTooltip}
                                  >
                                    {isBusy ? <Spinner size="sm" /> : label}
                                  </Button>

                                  <UncontrolledDropdown>
                                    <DropdownToggle tag="button" className="btn btn-sm btn-light">
                                      <i className="ri-more-2-fill"></i>
                                    </DropdownToggle>
                                    <DropdownMenu>
                                      <DropdownItem
                                        onClick={() => openReschedule(item)}
                                        disabled={isBusy || cur === "completed"}
                                      >
                                        <i className="ri-calendar-event-line me-2"></i> Reagendar
                                      </DropdownItem>
                                      <DropdownItem
                                        onClick={() => handleCancel(item)}
                                        disabled={isBusy || cur === "completed" || cur === "cancelled"}
                                      >
                                        <i className="ri-close-circle-line me-2"></i> Cancelar
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </UncontrolledDropdown>
                                </div>
                              </td>

                              <td>
                                <div className="d-flex flex-column">
                                  <span className="fw-semibold">{item.name}</span>
                                  <small className="text-muted">
                                    {item.time} {item.stylist ? `• ${item.stylist}` : ""}
                                  </small>
                                </div>
                              </td>

                              <td className="text-end">$ {item.total.toFixed(2)}</td>
                            </tr>
                          );
                        })}

                        <tr>
                          <td className="fw-semibold" colSpan={2}>Sub Total (listos):</td>
                          <td className="fw-semibold text-end">$ {total.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="d-grid mt-3">
                    <Button
                      color="primary"
                      size="lg"
                      disabled={disablePay}
                      onClick={handlePayNow}
                    >
                      Pagar ahora (${total.toFixed(2)})
                    </Button>
                  </div>
                  <small className="text-muted d-block mt-2">
                    * Solo se incluyen citas <b>Finalizadas (checked_out)</b>. Los pagos combinan tarjeta + efectivo si es necesario.
                  </small>
                </CardBody>
              </Card>
            </Col>
          </Row>
        )}

        {/* Modal Reagendar */}
        <Modal isOpen={resModalOpen} toggle={() => setResModalOpen(false)} centered>
          <ModalHeader toggle={() => setResModalOpen(false)}>
            Reagendar cita {resItem ? `• ${resItem.name}` : ""}
          </ModalHeader>
          <ModalBody>
            <Label className="form-label">Nueva fecha y hora</Label>
            <Input
              type="datetime-local"
              value={resDateTime}
              onChange={(e) => setResDateTime(e.target.value)}
            />
            <small className="text-muted d-block mt-2">
              Al guardar se actualizará la cita. Citas reagendadas o canceladas no se incluyen en el total.
            </small>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={() => setResModalOpen(false)}>Cancelar</Button>
            <Button color="primary" onClick={submitReschedule}>Guardar</Button>
          </ModalFooter>
        </Modal>
      </Container>
    </div>
  );
};

export default EcommerceCheckout;
