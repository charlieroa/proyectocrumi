import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Input } from "reactstrap";
import { Plus } from "lucide-react";

export type SupplierItem = {
  id?: number | string;
  name: string;
  document_number?: string;
  document_type?: string;
  email?: string;
};

type Props = {
  value: string;
  onChange: (name: string) => void;
  onPick?: (supplier: SupplierItem) => void;
  onCreateNew?: (seed: string) => void;
  suppliers: SupplierItem[];
  placeholder?: string;
  size?: "sm" | "lg";
  disabled?: boolean;
};

const SupplierPicker: React.FC<Props> = ({
  value,
  onChange,
  onPick,
  onCreateNew,
  suppliers,
  placeholder = "Nombre o NIT del proveedor",
  size,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputWrapRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && wrapRef.current.contains(t)) return;
      if (dropdownRef.current && dropdownRef.current.contains(t)) return;
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
      setRect({ top: r.bottom + 2, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suppliers.slice(0, 25);
    return suppliers
      .filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.document_number || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [suppliers, value]);

  const select = (s: SupplierItem) => {
    onChange(s.name);
    onPick?.(s);
    setOpen(false);
  };

  const dropdown =
    open && rect
      ? createPortal(
          <div
            ref={dropdownRef}
            className="bg-white border rounded shadow-sm"
            style={{
              position: "fixed",
              zIndex: 99999,
              top: rect.top,
              left: rect.left,
              width: rect.width,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <button
                  type="button"
                  key={(s.id ?? s.document_number ?? s.name) + "-" + i}
                  className="d-block w-100 text-start border-0 bg-transparent px-2 py-2 small"
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(s);
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f5f7")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div className="fw-semibold text-dark">{s.name}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {[s.document_type, s.document_number, s.email].filter(Boolean).join(" • ")}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-2 py-2 small text-muted">
                Sin proveedores que coincidan.
                {onCreateNew && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 align-baseline"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onCreateNew(value);
                        setOpen(false);
                      }}
                    >
                      Crear "{value}"
                    </button>
                  </>
                )}
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className="position-relative d-flex gap-2 flex-grow-1">
      <div ref={inputWrapRef} className="flex-grow-1 position-relative">
        <Input
          type="text"
          bsSize={size}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {dropdown}
      </div>
      {onCreateNew && (
        <Button
          color="light"
          size={size}
          type="button"
          disabled={disabled}
          title="Crear proveedor nuevo"
          onClick={() => onCreateNew(value)}
        >
          <Plus size={14} />
        </Button>
      )}
    </div>
  );
};

export default SupplierPicker;
