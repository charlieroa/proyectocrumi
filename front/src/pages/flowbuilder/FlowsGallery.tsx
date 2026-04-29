import React, { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiCopy } from "react-icons/fi";
import { FaWhatsapp, FaShoppingCart, FaFileInvoiceDollar, FaMoneyBillWave, FaGlobe, FaPoll } from "react-icons/fa";
import "../../assets/scss/flowbuilder/flows-gallery.scss";

interface SavedFlow {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  lastModified: string;
  nodeCount: number;
}

interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
}

interface FlowsGalleryProps {
  onCreateNew: () => void;
  onOpenFlow: (flowId: string) => void;
  onUseTemplate: (templateId: string) => void;
}

const FlowsGallery: React.FC<FlowsGalleryProps> = ({ 
  onCreateNew, 
  onOpenFlow,
  onUseTemplate 
}) => {
  // Flows guardados del usuario (simulados - conectar con tu backend)
  const [savedFlows] = useState<SavedFlow[]>([
    {
      id: "flow-1",
      name: "Atención al Cliente",
      description: "Flow principal para atender consultas",
      lastModified: "Hace 2 horas",
      nodeCount: 12
    },
    {
      id: "flow-2",
      name: "Proceso de Compra",
      description: "Automatización de ventas",
      lastModified: "Ayer",
      nodeCount: 8
    },
    {
      id: "flow-3",
      name: "Recordatorios",
      description: "Notificaciones automáticas",
      lastModified: "Hace 3 días",
      nodeCount: 5
    }
  ]);

  // Templates predefinidos
  const flowTemplates: FlowTemplate[] = [
    {
      id: "template-sales",
      name: "Ventas",
      description: "Automatiza tu proceso de ventas",
      icon: <FaShoppingCart size={32} />,
      category: "Business"
    },
    {
      id: "template-billing",
      name: "Facturación",
      description: "Gestiona facturas automáticamente",
      icon: <FaFileInvoiceDollar size={32} />,
      category: "Finance"
    },
    {
      id: "template-collections",
      name: "Cobros",
      description: "Recordatorios de pago automáticos",
      icon: <FaMoneyBillWave size={32} />,
      category: "Finance"
    },
    {
      id: "template-web-sales",
      name: "Vende desde tu Web",
      description: "Integra ventas en tu sitio web",
      icon: <FaGlobe size={32} />,
      category: "E-commerce"
    },
    {
      id: "template-surveys",
      name: "Encuestas",
      description: "Recopila feedback de clientes",
      icon: <FaPoll size={32} />,
      category: "Marketing"
    },
    {
      id: "template-customer-service",
      name: "Atención al Cliente",
      description: "Responde consultas 24/7",
      icon: <FaWhatsapp size={32} />,
      category: "Support"
    }
  ];

  const handleDeleteFlow = (flowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de eliminar este flow?")) {
      console.log("Eliminar flow:", flowId);
      // Aquí implementar la lógica de eliminación
    }
  };

  const handleDuplicateFlow = (flowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("Duplicar flow:", flowId);
    // Aquí implementar la lógica de duplicación
  };

  return (
    <div className="flows-gallery">
      {/* Header */}
      <div className="gallery-header">
        <h1>Mis Flows</h1>
        <p>Gestiona y crea flujos de automatización</p>
      </div>

      {/* Carousel de Flows Guardados */}
      <section className="flows-section">
        <div className="section-header">
          <h2>Tus Flows</h2>
          <span className="flow-count">{savedFlows.length} flows</span>
        </div>

        <div className="flows-carousel-horizontal">
          {/* Card para crear nuevo */}
          <div className="flow-card create-new-card" onClick={onCreateNew}>
            <div className="card-content">
              <div className="create-icon">
                <FiPlus size={48} />
              </div>
              <h3>Crear nuevo Flow</h3>
              <p>Empieza desde cero</p>
            </div>
          </div>

          {/* Cards de flows guardados */}
          {savedFlows.map((flow) => (
            <div 
              key={flow.id} 
              className="flow-card saved-flow-card"
              onClick={() => onOpenFlow(flow.id)}
            >
              <div className="card-thumbnail">
                {flow.thumbnail ? (
                  <img src={flow.thumbnail} alt={flow.name} />
                ) : (
                  <div className="thumbnail-placeholder">
                    <FiEdit2 size={32} />
                  </div>
                )}
              </div>
              
              <div className="card-info">
                <h3>{flow.name}</h3>
                <p>{flow.description}</p>
                
                <div className="card-meta">
                  <span className="meta-item">
                    {flow.nodeCount} nodos
                  </span>
                  <span className="meta-item">
                    {flow.lastModified}
                  </span>
                </div>
              </div>

              <div className="card-actions">
                <button 
                  className="action-btn"
                  onClick={(e) => handleDuplicateFlow(flow.id, e)}
                  title="Duplicar"
                >
                  <FiCopy size={16} />
                </button>
                <button 
                  className="action-btn delete-btn"
                  onClick={(e) => handleDeleteFlow(flow.id, e)}
                  title="Eliminar"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Carousel de Templates */}
      <section className="flows-section templates-section">
        <div className="section-header">
          <h2>Templates Predefinidos</h2>
          <p>Comienza con una plantilla lista para usar</p>
        </div>

        <div className="flows-carousel">
          {flowTemplates.map((template) => (
            <div 
              key={template.id}
              className="flow-card template-card"
              onClick={() => onUseTemplate(template.id)}
            >
              <div className="template-icon">
                {template.icon}
              </div>
              
              <div className="card-info">
                <span className="template-category">{template.category}</span>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
              </div>

              <div className="template-badge">
                Usar Template
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default FlowsGallery;