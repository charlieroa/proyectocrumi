import React, { useCallback, useState, useEffect, useMemo } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  useEdgesState,
  useNodesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  Handle, 
  Position, 
  NodeProps,
} from "reactflow";

import { RiDeleteBinLine } from "react-icons/ri";
import { FiPlus, FiCopy, FiColumns } from "react-icons/fi";
import { GiSparkles } from "react-icons/gi";
import { FaWhatsapp, FaSave } from "react-icons/fa";

import "reactflow/dist/style.css";
import "../../assets/scss/flowbuilder/flowbuilder.scss";
import "../../assets/scss/flowbuilder/nodes.scss"; 
import Drawer from "./Drawer";
import FlowsGallery from "./FlowsGallery";

// Importamos los nuevos nodos
import TextNode from "../../Components/nodes/TextNode";
import OptionsNode from "../../Components/nodes/OptionsNode";
import MediaNode from "../../Components/nodes/MediaNode";

// Tipo para las vistas del Drawer
export type DrawerAppView = 
  | "main" 
  | "channels" 
  | "flow" 
  | "ai" 
  | "core" 
  | "configuring-whatsapp" 
  | "configuring-text" 
  | "configuring-options" 
  | "configuring-media";

// ===============================================================
// Nodo WhatsApp - CON CLICK HANDLER Y DELETE
// ===============================================================
const WhatsAppNode: React.FC<NodeProps> = ({ data, id }) => {
  return (
    <div className="whatsapp-node">
      <Handle type="target" position={Position.Left} className="handle" />
      
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
        onClick={() => data.onNodeClick?.(id, 'whatsapp')}
        style={{ cursor: 'pointer' }}
      >
        <div className="node-icon-wrapper whatsapp">
          <FaWhatsapp size={24} color="white" />
        </div>
        <div className="node-text">
          <strong>{data.label || "Send message"}</strong>
          <small>{data.subtext || "message:send"}</small>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="handle" />
    </div>
  );
};

// ===============================================================
// Edge personalizado con animación
// ===============================================================
const CustomEdge = ({ 
  id, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  style = {}, 
  markerEnd, 
  data 
}: any) => {
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path custom-edge-path"
        d={`M${sourceX},${sourceY} C${sourceX},${centerY} ${targetX},${centerY} ${targetX},${targetY}`}
        markerEnd={markerEnd}
      />
      <foreignObject
        width={30}
        height={30}
        x={centerX - 15}
        y={centerY - 15}
        requiredExtensions="http://www.w3.org/1999/xhtml"
        className="edge-button-container"
      >
        <div className="edge-button-wrapper">
          <RiDeleteBinLine 
            onClick={(e) => {
              e.stopPropagation();
              data?.onDelete?.(id);
            }} 
            className="edge-delete-icon" 
          />
        </div>
      </foreignObject>
    </>
  );
};

// ===============================================================
// Contenido principal del Flow
// ===============================================================
interface FlowContentProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: any;
  onOpenDrawer: () => void;
  onSaveFlow: (flowData: object) => void;
  onNodeClick: (nodeId: string, nodeType: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onShowGallery: () => void;
}

const FlowContent: React.FC<FlowContentProps> = ({ 
  nodes, 
  edges, 
  onNodesChange, 
  onEdgesChange, 
  onConnect, 
  onOpenDrawer, 
  onSaveFlow,
  onNodeClick,
  onDeleteNode,
  onDeleteEdge,
  onShowGallery
}) => {
  const { setViewport, toObject } = useReactFlow();

  const nodesWithHandlers = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onNodeClick,
        onDeleteNode
      }
    }));
  }, [nodes, onNodeClick, onDeleteNode]);

  const edgesWithHandlers = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      animated: true,
      style: { stroke: '#b1b1b7', strokeWidth: 2 },
      data: {
        ...edge.data,
        onDelete: onDeleteEdge
      }
    }));
  }, [edges, onDeleteEdge]);

  const nodeTypes = useMemo(
    () => ({
      whatsapp: WhatsAppNode,
      text: TextNode,
      options: OptionsNode,
      media: MediaNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      default: CustomEdge,
    }),
    []
  );

  useEffect(() => {
    setViewport({ x: 0, y: 0, zoom: 1.2 }, { duration: 800 });
  }, [setViewport]);

  const handleSave = useCallback(() => {
    const flowData = toObject(); 
    onSaveFlow(flowData);
  }, [toObject, onSaveFlow]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHandlers}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode="Delete"
      >
        <MiniMap />
        <Controls />
        <Background gap={16} color="#ddd" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="empty-state" onClick={onOpenDrawer}>
          <div className="empty-box">+</div>
          <p>Add first step...</p>
        </div>
      )}

      {/* Toolbox vertical en el lado derecho */}
      <div className="toolbox-vertical" style={{ 
        position: 'absolute', 
        top: '50%',
        right: '16px', 
        transform: 'translateY(-50%)',
        zIndex: 5,
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <button 
          className="tool-btn" 
          onClick={onOpenDrawer}
          title="Add new node"
        >
          <FiPlus size={20} />
        </button>

        <button 
          className="tool-btn" 
          onClick={handleSave} 
          title="Save flow"
        >
          <FaSave size={18} />
        </button>

        <button 
          className="tool-btn" 
          onClick={onShowGallery}
          title="View flows gallery"
        >
          <FiColumns size={18} />
        </button>

        <button 
          className="tool-btn tool-btn-magic" 
          title="AI Magic"
        >
          <GiSparkles size={20} />
        </button>
      </div>
    </div>
  );
};

// ===============================================================
// FlowBuilder principal
// ===============================================================
const FlowBuilder: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerAppView>("main");

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      const newEdge = {
        ...params,
        animated: true,
        style: { stroke: '#b1b1b7', strokeWidth: 2 }
      };
      setEdges((eds) => addEdge(newEdge, eds));
    }, 
    [setEdges]
  );

  const handleOpenDrawer = () => {
    if (nodes.length === 0) {
      setDrawerView("main");
    }
    setIsDrawerOpen(true);
  };
  
  const handleSaveFlow = useCallback((flowData: object) => {
    const jsonString = JSON.stringify(flowData, null, 2);
    console.log("—— Guardando Flujo ——");
    console.log(jsonString);
    alert("✅ ¡Flujo guardado exitosamente!\n\nRevisa la consola para ver la estructura JSON.");
  }, []);

  const handleAddNode = (type: string) => {
    const newNode: Node = {
      id: `${type}-${+new Date()}`,
      type,
      position: { x: 100, y: 100 },
      data: { label: "Send message" },
    };

    setNodes((nds: Node[]) => nds.concat(newNode));
    setSelectedNodeId(newNode.id);

    if (type === "whatsapp") setDrawerView("configuring-whatsapp");
    if (type === "text") setDrawerView("configuring-text");
    if (type === "options") setDrawerView("configuring-options");
    if (type === "media") setDrawerView("configuring-media");
  };

  const handleNodeClick = useCallback((nodeId: string, nodeType: string) => {
    setSelectedNodeId(nodeId);
    setIsDrawerOpen(true);
    
    if (nodeType === "whatsapp") setDrawerView("configuring-whatsapp");
    if (nodeType === "text") setDrawerView("configuring-text");
    if (nodeType === "options") setDrawerView("configuring-options");
    if (nodeType === "media") setDrawerView("configuring-media");
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId
    ));
    if (selectedNodeId === nodeId) {
      setIsDrawerOpen(false);
      setSelectedNodeId(null);
    }
  }, [setNodes, setEdges, selectedNodeId]);

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  const handleUpdateNode = useCallback((nodeData: any) => {
    if (!selectedNodeId) return;
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, ...nodeData } }
          : node
      )
    );
  }, [selectedNodeId, setNodes]);

  const selectedNode = useMemo(() => {
    return nodes.find(node => node.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Handlers para la galería
  const handleCreateNewFlow = () => {
    setShowGallery(false);
    setNodes([]);
    setEdges([]);
  };

  const handleOpenFlow = (flowId: string) => {
    console.log("Abrir flow:", flowId);
    // TODO: Cargar el flow desde el backend
    setShowGallery(false);
  };

  const handleUseTemplate = (templateId: string) => {
    console.log("Usar template:", templateId);
    // TODO: Cargar template predefinido
    setShowGallery(false);
  };

  // Si está mostrando la galería, renderizar FlowsGallery
  if (showGallery) {
    return (
      <FlowsGallery
        onCreateNew={handleCreateNewFlow}
        onOpenFlow={handleOpenFlow}
        onUseTemplate={handleUseTemplate}
      />
    );
  }

  return (
    <div style={{ 
      width: "100%", 
      height: "calc(100vh - 80px)", 
      position: "relative",
      overflow: "hidden"
    }}>
      <ReactFlowProvider>
        <FlowContent
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onOpenDrawer={handleOpenDrawer}
          onSaveFlow={handleSaveFlow}
          onNodeClick={handleNodeClick}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onShowGallery={() => setShowGallery(true)}
        />
      </ReactFlowProvider>

      <Drawer
        open={isDrawerOpen}
        view={drawerView}
        onClose={() => setIsDrawerOpen(false)}
        onSetView={setDrawerView}
        onAddNode={handleAddNode}
        selectedNode={selectedNode}
        onUpdateNode={handleUpdateNode}
      />
    </div>
  );
};

export default FlowBuilder;