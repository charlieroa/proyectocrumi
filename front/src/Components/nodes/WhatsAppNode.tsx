import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { FaWhatsapp } from "react-icons/fa";
import "../../assets/scss/flowbuilder/nodes.scss";

const WhatsAppNode: React.FC<NodeProps> = ({ id, data }) => {
  return (
    <div
      className="whatsapp-node node-wrapper"
      onClick={() => data?.onSelect?.(id, "whatsapp")}
    >
      <Handle type="target" position={Position.Left} className="handle" />

      <div className="node-content">
        <div className="node-icon-wrapper whatsapp">
          <FaWhatsapp size={24} color="white" />
        </div>
        <div className="node-text">
          <strong>{data.label || "Send message"}</strong>
          <small>{data.subtext || "message:send"}</small>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="handle" />

      {/* Botón eliminar nodo */}
      <button
        className="node-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          data?.onDelete?.(id);
        }}
      >
        ×
      </button>
    </div>
  );
};

export default WhatsAppNode;
