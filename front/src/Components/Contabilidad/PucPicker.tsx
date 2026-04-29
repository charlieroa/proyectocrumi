// Reusable PUC (Plan Único de Cuentas) picker.
// - Input con autocomplete que filtra cuentas cuyo CÓDIGO empieza con lo que se escribe
//   (p. ej. "14" muestra todas las 14XXXX).
// - Botón al lado para abrir un submodal con TODO el PUC, búsqueda y selección.
// Útil para: factura de compra (Gasto), crear producto de venta (Ingreso), config contable.

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalHeader,
  Table,
} from "reactstrap";
import { ListTree, Search } from "lucide-react";

export type PucAccount = {
  id?: string | number;
  code: string;
  name: string;
  account_type?: string;
};

type Props = {
  value: string;
  onChange: (code: string) => void;
  accounts: PucAccount[];
  // Prefijo por defecto (ej. "4" para ingresos, "5" o "6" para gastos). undefined = todo.
  prefixFilter?: string | string[];
  placeholder?: string;
  size?: "sm" | "lg";
  disabled?: boolean;
  maxDigits?: number;
};

const DEFAULT_MAX = 8;

const PucPicker: React.FC<Props> = ({
  value,
  onChange,
  accounts,
  prefixFilter,
  placeholder = "Código PUC (ej. 14, 4135, 61355)",
  size = "sm",
  disabled,
  maxDigits = DEFAULT_MAX,
}) => {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && wrapRef.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!inputWrapRef.current) return;
      const r = inputWrapRef.current.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 2, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const filterByPrefix = (list: PucAccount[]) => {
    if (!prefixFilter) return list;
    const prefixes = Array.isArray(prefixFilter) ? prefixFilter : [prefixFilter];
    return list.filter((a) => prefixes.some((p) => (a.code || "").startsWith(p)));
  };

  const universe = useMemo(() => filterByPrefix(accounts), [accounts, prefixFilter]);

  // Autocomplete: filtra por lo que empieza con el código tipeado.
  const suggestions = useMemo(() => {
    const q = String(value || "").trim();
    if (!q) return universe.slice(0, 20);
    return universe
      .filter(
        (a) =>
          (a.code || "").startsWith(q) ||
          (a.name || "").toLowerCase().includes(q.toLowerCase()),
      )
      .slice(0, 40);
  }, [universe, value]);

  // Modal: búsqueda libre (code prefix OR name includes).
  const modalResults = useMemo(() => {
    const q = modalQuery.trim().toLowerCase();
    if (!q) return universe;
    return universe.filter(
      (a) =>
        (a.code || "").startsWith(modalQuery.trim()) ||
        (a.name || "").toLowerCase().includes(q),
    );
  }, [universe, modalQuery]);

  const handleChange = (raw: string) => {
    // PUC solo acepta dígitos
    const cleaned = raw.replace(/[^0-9]/g, "").slice(0, maxDigits);
    onChange(cleaned);
    setOpen(true);
  };

  const selectFromList = (code: string) => {
    onChange(code);
    setOpen(false);
    setModalOpen(false);
  };

  const dropdownPortal =
    open && dropdownRect
      ? createPortal(
          <div
            ref={dropdownRef}
            className="bg-white border rounded shadow-sm"
            style={{
              position: "fixed",
              zIndex: 99999,
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((a) => (
                <button
                  type="button"
                  key={a.code}
                  className="d-block w-100 text-start border-0 bg-transparent px-2 py-2 small"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectFromList(a.code);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span className="fw-semibold text-dark">{a.code}</span>
                  <span className="text-muted ms-2">{a.name}</span>
                </button>
              ))
            ) : String(value || "").trim() ? (
              <div className="px-2 py-2 small text-muted">
                Sin cuentas que coincidan. Abrí el PUC completo →
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className="position-relative d-flex gap-1">
      <div ref={inputWrapRef} className="flex-grow-1 position-relative">
        <Input
          type="text"
          bsSize={size}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="numeric"
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {dropdownPortal}
      </div>

      <Button
        color="light"
        size={size}
        type="button"
        disabled={disabled}
        title="Ver todo el PUC"
        onClick={() => {
          setModalQuery(value);
          setModalOpen(true);
          setOpen(false);
        }}
      >
        <ListTree size={14} />
      </Button>

      {/* Modal con todo el PUC */}
      <Modal
        isOpen={modalOpen}
        toggle={() => setModalOpen(false)}
        size="lg"
        scrollable
        centered
      >
        <ModalHeader toggle={() => setModalOpen(false)}>
          <div className="d-flex align-items-center gap-2">
            <ListTree size={20} />
            <span>Plan Único de Cuentas (PUC)</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="position-relative mb-3">
            <Input
              value={modalQuery}
              onChange={(e) => setModalQuery(e.target.value)}
              placeholder="Buscar por código (ej. 14) o nombre (ej. bancos)..."
              autoFocus
            />
            <Search
              size={16}
              className="position-absolute"
              style={{ right: 12, top: 12, color: "#888" }}
            />
          </div>
          <div className="small text-muted mb-2">
            {modalResults.length} cuenta{modalResults.length === 1 ? "" : "s"}{" "}
            {modalQuery ? `que coinciden con "${modalQuery}"` : "disponibles"}
            {prefixFilter
              ? ` (filtradas por clase ${
                  Array.isArray(prefixFilter) ? prefixFilter.join("/") : prefixFilter
                })`
              : ""}
            .
          </div>
          <div className="table-responsive" style={{ maxHeight: "60vh" }}>
            <Table size="sm" hover className="align-middle mb-0">
              <thead
                className="table-light"
                style={{ position: "sticky", top: 0, zIndex: 1 }}
              >
                <tr>
                  <th style={{ width: 110 }}>Código</th>
                  <th>Nombre</th>
                  <th style={{ width: 70 }} />
                </tr>
              </thead>
              <tbody>
                {modalResults.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-3">
                      Sin resultados.
                    </td>
                  </tr>
                )}
                {modalResults.map((a) => (
                  <tr
                    key={a.code}
                    style={{ cursor: "pointer" }}
                    onClick={() => selectFromList(a.code)}
                  >
                    <td>
                      <span className="fw-semibold font-monospace">{a.code}</span>
                    </td>
                    <td>{a.name}</td>
                    <td className="text-end">
                      <Button color="primary" size="sm" type="button">
                        Elegir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
};

export default PucPicker;
