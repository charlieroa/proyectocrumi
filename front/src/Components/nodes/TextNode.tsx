import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { RiDeleteBinLine } from "react-icons/ri";

const TextNode: React.FC<NodeProps> = ({ data, id }) => {
  return (
    <div className="text-node">
      <Handle type="target" position={Position.Left} className="handle" />
      
      {/* Botón de eliminar */}
      <button 
        className="node-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          data.onDeleteNode?.(id);
        }}
        title="Delete node"
      >
        <RiDeleteBinLine size={14} />
      </button>

      <div 
        className="node-content"
        onClick={() => data.onNodeClick?.(id, 'text')}
        style={{ cursor: 'pointer' }}
      >
        <div className="node-icon-wrapper text">
          <span>📝</span>
        </div>
        <div className="node-text">
          <strong>{data.label || "Text Message"}</strong>
          <small>{data.content?.substring(0, 30) || "No content"}</small>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
};

export default TextNode;