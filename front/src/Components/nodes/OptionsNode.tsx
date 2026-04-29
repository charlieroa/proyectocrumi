import React from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { RiDeleteBinLine } from "react-icons/ri";

const OptionsNode: React.FC<NodeProps> = ({ data, id }) => {
  return (
    <div className="options-node">
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
        onClick={() => data.onNodeClick?.(id, 'options')}
        style={{ cursor: 'pointer' }}
      >
        <div className="node-icon-wrapper options">
          <span>🔘</span>
        </div>
        <div className="node-text">
          <strong>{data.label || "Options"}</strong>
          <small>
            {data.options?.filter((o: string) => o).length || 0} options
          </small>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
};

export default OptionsNode;