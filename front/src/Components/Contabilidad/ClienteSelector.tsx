// Reusable customer (cliente) picker.
// UX: pseudo "select con búsqueda" — un input editable con placeholder "Buscar cliente..."
// abre un dropdown debajo con la lista filtrada (NOMBRE - NIT). Al clickear una fila
// se selecciona y se cierra. Mismo patrón que PucPicker pero para clientes.
//
// Carga la lista UNA sola vez del backend (GET /accounting/third-parties?kind=CUSTOMER)
// y la cachea en memoria a nivel de módulo para no re-fetchar entre modales.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Button,
    Col,
    Input,
    Label,
    Modal,
    ModalBody,
    ModalFooter,
    ModalHeader,
    Row,
    Spinner,
} from "reactstrap";
import { UserPlus } from "lucide-react";
import { env } from "../../env";
import { getToken } from "../../services/auth";

export type Cliente = {
    id: number | string;
    name: string;
    document_number: string;
    document_type?: string;
    email?: string;
    phone?: string;
};

// Cache en memoria a nivel de módulo — evita re-fetchar por cada modal que use
// el selector. Se invalida recargando la página o llamando `invalidateClientesCache`.
let clientesCache: Cliente[] | null = null;
let clientesInflight: Promise<Cliente[]> | null = null;

export const invalidateClientesCache = () => {
    clientesCache = null;
    clientesInflight = null;
};

const fetchClientes = async (): Promise<Cliente[]> => {
    if (clientesCache) return clientesCache;
    if (clientesInflight) return clientesInflight;
    const token = getToken();
    clientesInflight = fetch(`${env.API_URL}/accounting/third-parties?kind=CUSTOMER`, {
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    })
        .then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            const list: Cliente[] = d.thirdParties || d.third_parties || d.parties || [];
            clientesCache = list;
            return list;
        })
        .catch(() => {
            clientesInflight = null;
            return [];
        });
    return clientesInflight;
};

type Props = {
    value: string | number | null;
    onChange: (cliente: Cliente | null) => void;
    size?: "sm" | "lg";
    placeholder?: string;
    disabled?: boolean;
    onCreate?: () => void;          // si se pasa, override del modal interno
    allowCreate?: boolean;           // si true (y sin onCreate), muestra botón + abre modal interno
    fallbackLabel?: string;
};

const DOC_TYPES_CO = ['NIT', 'CC', 'CE', 'PP', 'TI'];

const ClienteSelector: React.FC<Props> = ({
    value,
    onChange,
    size = "sm",
    placeholder = "Buscar cliente...",
    disabled,
    onCreate,
    allowCreate,
    fallbackLabel,
}) => {
    const [clientes, setClientes] = useState<Cliente[]>(() => clientesCache || []);
    const [loading, setLoading] = useState<boolean>(!clientesCache);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapRef = useRef<HTMLDivElement | null>(null);

    // Modal interno "Nuevo cliente" (si allowCreate y sin onCreate custom)
    const [createOpen, setCreateOpen] = useState(false);
    const [createSaving, setCreateSaving] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newClient, setNewClient] = useState({
        document_type: 'NIT',
        document_number: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
    });

    const resetNewClient = () => {
        setNewClient({
            document_type: 'NIT',
            document_number: '',
            name: '',
            email: '',
            phone: '',
            address: '',
            city: '',
        });
        setCreateError(null);
    };

    const handleCreateSubmit = async () => {
        setCreateError(null);
        if (!newClient.name.trim()) {
            setCreateError('El nombre / razón social es obligatorio.');
            return;
        }
        if (!newClient.document_number.trim()) {
            setCreateError('El número de documento es obligatorio.');
            return;
        }
        setCreateSaving(true);
        try {
            const token = getToken();
            const res = await fetch(`${env.API_URL}/accounting/third-parties`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    kind: 'CUSTOMER',
                    name: newClient.name.trim(),
                    document_type: newClient.document_type,
                    document_number: newClient.document_number.trim(),
                    email: newClient.email.trim() || undefined,
                    phone: newClient.phone.trim() || undefined,
                    address: newClient.address.trim() || undefined,
                    city: newClient.city.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !(data?.success ?? true)) {
                setCreateError(data?.error || data?.message || `Error ${res.status}: no se pudo crear.`);
                return;
            }
            const created: Cliente = data.thirdParty || data.third_party || data.party || {
                id: data.id || Date.now(),
                name: newClient.name.trim(),
                document_number: newClient.document_number.trim(),
                email: newClient.email.trim() || undefined,
                phone: newClient.phone.trim() || undefined,
            };
            // Actualizar cache global + estado local
            invalidateClientesCache();
            const next = [created, ...clientes.filter((c) => String(c.id) !== String(created.id))];
            clientesCache = next;
            setClientes(next);
            onChange(created);
            setCreateOpen(false);
            resetNewClient();
        } catch (e: any) {
            setCreateError('Error de red: ' + (e?.message || ''));
        } finally {
            setCreateSaving(false);
        }
    };

    const openCreateFlow = () => {
        setOpen(false);
        if (onCreate) {
            onCreate();
            return;
        }
        if (allowCreate) {
            resetNewClient();
            setCreateOpen(true);
        }
    };

    useEffect(() => {
        let alive = true;
        if (!clientesCache) {
            setLoading(true);
            fetchClientes().then((list) => {
                if (!alive) return;
                setClientes(list);
                setLoading(false);
            });
        } else {
            setClientes(clientesCache);
            setLoading(false);
        }
        return () => {
            alive = false;
        };
    }, []);

    // Cerrar dropdown al click fuera
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!wrapRef.current) return;
            if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const selected = useMemo(() => {
        if (value == null || value === "") return null;
        return (
            clientes.find(
                (c) =>
                    String(c.id) === String(value) ||
                    c.document_number === String(value) ||
                    c.name === String(value),
            ) || null
        );
    }, [clientes, value]);

    const displayLabel = selected
        ? `${selected.name}${selected.document_number ? ` · ${selected.document_number}` : ""}`
        : fallbackLabel || "";

    // Cuando el dropdown está cerrado el input muestra el label del seleccionado;
    // al abrirlo se vacía el query para búsqueda nueva.
    const inputValue = open ? query : displayLabel;

    const suggestions = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return clientes.slice(0, 40);
        return clientes
            .filter((c) => {
                const hay = `${c.name || ""} ${c.document_number || ""} ${c.email || ""}`.toLowerCase();
                return hay.includes(q);
            })
            .slice(0, 60);
    }, [clientes, query]);

    const handleSelect = (c: Cliente) => {
        onChange(c);
        setQuery("");
        setOpen(false);
    };

    const handleClear = () => {
        onChange(null);
        setQuery("");
    };

    return (
        <div ref={wrapRef} className="position-relative d-flex gap-1">
            <div className="flex-grow-1 position-relative">
                <Input
                    type="text"
                    bsSize={size}
                    value={inputValue}
                    placeholder={loading ? "Cargando clientes..." : placeholder}
                    disabled={disabled || loading}
                    onFocus={() => {
                        setOpen(true);
                        setQuery("");
                    }}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        if (!e.target.value.trim() && selected) {
                            // Si vacía el texto, desseleccionar
                            handleClear();
                        }
                    }}
                />
                {loading && (
                    <Spinner
                        size="sm"
                        color="secondary"
                        className="position-absolute"
                        style={{ right: 8, top: 8 }}
                    />
                )}
                {open && !loading && (
                    <div
                        className="position-absolute bg-white border rounded shadow-sm"
                        style={{
                            zIndex: 1080,
                            top: "100%",
                            left: 0,
                            right: 0,
                            maxHeight: 280,
                            overflowY: "auto",
                            marginTop: 2,
                        }}
                    >
                        {suggestions.length === 0 ? (
                            <div className="px-2 py-2 small text-muted">
                                {clientes.length === 0
                                    ? "No hay clientes cargados."
                                    : `Sin clientes que coincidan con "${query}".`}
                            </div>
                        ) : (
                            suggestions.map((c) => (
                                <button
                                    type="button"
                                    key={c.id}
                                    className="d-block w-100 text-start border-0 bg-transparent px-2 py-2 small"
                                    style={{ cursor: "pointer" }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelect(c);
                                    }}
                                    onMouseEnter={(e) =>
                                        (e.currentTarget.style.background = "#f4f5f7")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = "transparent")
                                    }
                                >
                                    <span className="fw-semibold text-dark">{c.name}</span>
                                    {c.document_number && (
                                        <span className="text-muted ms-2">
                                            · {c.document_number}
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {(onCreate || allowCreate) && (
                <Button
                    color="light"
                    size={size}
                    type="button"
                    disabled={disabled}
                    title="Nuevo cliente"
                    onClick={openCreateFlow}
                >
                    <UserPlus size={14} />
                </Button>
            )}

            {/* Modal interno: Nuevo cliente */}
            <Modal
                isOpen={createOpen}
                toggle={() => setCreateOpen(false)}
                centered
                size="md"
            >
                <ModalHeader toggle={() => setCreateOpen(false)}>
                    Nuevo cliente
                </ModalHeader>
                <ModalBody>
                    {createError && (
                        <Alert color="danger" fade={false} className="py-2 mb-3">
                            {createError}
                        </Alert>
                    )}
                    <Row className="g-3">
                        <Col md={12}>
                            <Label className="small fw-medium mb-1">Nombre / razón social *</Label>
                            <Input
                                value={newClient.name}
                                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                placeholder="Ej. Industrias ACME S.A.S."
                                autoFocus
                            />
                        </Col>
                        <Col md={4}>
                            <Label className="small fw-medium mb-1">Tipo doc.</Label>
                            <Input
                                type="select"
                                value={newClient.document_type}
                                onChange={(e) => setNewClient({ ...newClient, document_type: e.target.value })}
                            >
                                {DOC_TYPES_CO.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </Input>
                        </Col>
                        <Col md={8}>
                            <Label className="small fw-medium mb-1">Número documento *</Label>
                            <Input
                                value={newClient.document_number}
                                onChange={(e) => setNewClient({ ...newClient, document_number: e.target.value })}
                                placeholder="900123456-7"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="small fw-medium mb-1">Email</Label>
                            <Input
                                type="email"
                                value={newClient.email}
                                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                placeholder="contacto@cliente.com"
                            />
                        </Col>
                        <Col md={6}>
                            <Label className="small fw-medium mb-1">Teléfono</Label>
                            <Input
                                value={newClient.phone}
                                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                                placeholder="+57 300 123 4567"
                            />
                        </Col>
                        <Col md={8}>
                            <Label className="small fw-medium mb-1">Dirección</Label>
                            <Input
                                value={newClient.address}
                                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                            />
                        </Col>
                        <Col md={4}>
                            <Label className="small fw-medium mb-1">Ciudad</Label>
                            <Input
                                value={newClient.city}
                                onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                            />
                        </Col>
                    </Row>
                </ModalBody>
                <ModalFooter>
                    <Button color="light" onClick={() => setCreateOpen(false)} disabled={createSaving}>
                        Cancelar
                    </Button>
                    <Button color="primary" onClick={handleCreateSubmit} disabled={createSaving}>
                        {createSaving ? <Spinner size="sm" /> : 'Guardar cliente'}
                    </Button>
                </ModalFooter>
            </Modal>
        </div>
    );
};

export default ClienteSelector;
