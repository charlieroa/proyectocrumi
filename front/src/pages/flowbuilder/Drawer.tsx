import React, { useState, useEffect } from "react";
import { FiGitBranch, FiCpu } from "react-icons/fi";
import { FaRobot, FaWhatsapp, FaTelegramPlane } from "react-icons/fa";
import "../../assets/scss/flowbuilder/drawer.scss";

// 🔹 Tipo actualizado con todas las vistas
export type DrawerAppView = 
  | 'main' 
  | 'channels' 
  | 'flow' 
  | 'ai' 
  | 'core' 
  | 'configuring-whatsapp'
  | 'configuring-text'
  | 'configuring-options'
  | 'configuring-media';

interface DrawerProps {
  open: boolean;
  view: DrawerAppView;
  onClose: () => void;
  onSetView: (view: DrawerAppView) => void;
  onAddNode: (type: string) => void;
  selectedNode?: any | null;
  onUpdateNode?: (nodeData: any) => void;
}

const Drawer: React.FC<DrawerProps> = ({ 
  open, 
  view, 
  onClose, 
  onSetView, 
  onAddNode,
  selectedNode,
  onUpdateNode 
}) => {
  
  // 🔹 Estados locales para los formularios
  const [formData, setFormData] = useState({
    label: '',
    template: '',
    variables: '',
    content: '',
    delay: 0,
    question: '',
    options: ['', '', ''],
    mediaType: 'image',
    mediaUrl: '',
    caption: ''
  });

  // 🔹 Cargar datos del nodo seleccionado cuando cambie
  useEffect(() => {
    if (selectedNode) {
      setFormData({
        label: selectedNode.data.label || '',
        template: selectedNode.data.template || '',
        variables: selectedNode.data.variables || '',
        content: selectedNode.data.content || '',
        delay: selectedNode.data.delay || 0,
        question: selectedNode.data.question || '',
        options: selectedNode.data.options || ['', '', ''],
        mediaType: selectedNode.data.mediaType || 'image',
        mediaUrl: selectedNode.data.mediaUrl || '',
        caption: selectedNode.data.caption || ''
      });
    }
  }, [selectedNode]);

  // 🔹 Handler para cambios en los inputs
  const handleInputChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    
    // Actualizar el nodo en tiempo real
    if (onUpdateNode) {
      onUpdateNode(newFormData);
    }
  };

  // ===============================================================
  // MENÚ PRINCIPAL
  // ===============================================================
  const renderMainMenu = () => (
    <ul className="drawer-options">
      <li onClick={() => onSetView("channels")}>
        <div className="drawer-item">
          <span className="drawer-icon"><FaWhatsapp size={18} /></span>
          <div className="drawer-text">
            <strong>Channels</strong>
            <small>WhatsApp, Telegram and more</small>
          </div>
        </div>
      </li>
      <li onClick={() => onSetView("flow")}>
        <div className="drawer-item">
          <span className="drawer-icon"><FiGitBranch size={18} /></span>
          <div className="drawer-text">
            <strong>Flow</strong>
            <small>Branch, merge or loop the flow</small>
          </div>
        </div>
      </li>
      <li onClick={() => onSetView("ai")}>
        <div className="drawer-item">
          <span className="drawer-icon"><FaRobot size={18} /></span>
          <div className="drawer-text">
            <strong>AI</strong>
            <small>Build autonomous agents, search docs</small>
          </div>
        </div>
      </li>
      <li onClick={() => onSetView("core")}>
        <div className="drawer-item">
          <span className="drawer-icon"><FiCpu size={18} /></span>
          <div className="drawer-text">
            <strong>Core</strong>
            <small>Run code, make HTTP requests</small>
          </div>
        </div>
      </li>
    </ul>
  );

  // ===============================================================
  // MENÚ DE CHANNELS
  // ===============================================================
  const renderChannelsMenu = () => (
    <ul className="drawer-options">
      <li onClick={() => onAddNode('whatsapp')}>
        <div className="drawer-item">
          <span className="drawer-icon"><FaWhatsapp size={18} color="#25D366" /></span>
          <div className="drawer-text">
            <strong>WhatsApp</strong>
            <small>Send or receive messages</small>
          </div>
        </div>
      </li>
      <li onClick={() => onAddNode('telegram')}>
        <div className="drawer-item">
          <span className="drawer-icon"><FaTelegramPlane size={18} color="#0088cc" /></span>
          <div className="drawer-text">
            <strong>Telegram</strong>
            <small>Send or receive messages</small>
          </div>
        </div>
      </li>
      <li className="back-btn" onClick={() => onSetView("main")}>← Back</li>
    </ul>
  );

  // ===============================================================
  // MENÚ DE FLOW
  // ===============================================================
  const renderFlowMenu = () => (
    <ul className="drawer-options">
      <li onClick={() => onAddNode('text')}>
        <div className="drawer-item">
          <span className="drawer-icon">📝</span>
          <div className="drawer-text">
            <strong>Text Node</strong>
            <small>Send text messages</small>
          </div>
        </div>
      </li>
      <li onClick={() => onAddNode('options')}>
        <div className="drawer-item">
          <span className="drawer-icon">🔘</span>
          <div className="drawer-text">
            <strong>Options Node</strong>
            <small>Create interactive buttons</small>
          </div>
        </div>
      </li>
      <li onClick={() => onAddNode('media')}>
        <div className="drawer-item">
          <span className="drawer-icon">🖼️</span>
          <div className="drawer-text">
            <strong>Media Node</strong>
            <small>Send images, videos or files</small>
          </div>
        </div>
      </li>
      <li className="back-btn" onClick={() => onSetView("main")}>← Back</li>
    </ul>
  );

  // ===============================================================
  // MENÚ DE AI
  // ===============================================================
  const renderAIMenu = () => (
    <ul className="drawer-options">
      <li onClick={() => console.log('AI Agent node')}>
        <div className="drawer-item">
          <span className="drawer-icon"><FaRobot size={18} /></span>
          <div className="drawer-text">
            <strong>AI Agent</strong>
            <small>Create an intelligent bot</small>
          </div>
        </div>
      </li>
      <li className="back-btn" onClick={() => onSetView("main")}>← Back</li>
    </ul>
  );

  // ===============================================================
  // MENÚ DE CORE
  // ===============================================================
  const renderCoreMenu = () => (
    <ul className="drawer-options">
      <li onClick={() => console.log('HTTP Request node')}>
        <div className="drawer-item">
          <span className="drawer-icon">🌐</span>
          <div className="drawer-text">
            <strong>HTTP Request</strong>
            <small>Make API calls</small>
          </div>
        </div>
      </li>
      <li onClick={() => console.log('Run Code node')}>
        <div className="drawer-item">
          <span className="drawer-icon">💻</span>
          <div className="drawer-text">
            <strong>Run Code</strong>
            <small>Execute custom JavaScript</small>
          </div>
        </div>
      </li>
      <li className="back-btn" onClick={() => onSetView("main")}>← Back</li>
    </ul>
  );

  // ===============================================================
  // CONFIGURACIÓN: WHATSAPP
  // ===============================================================
  const renderWhatsAppConfig = () => (
    <div className="drawer-config">
      <p className="config-description">
        Configure your WhatsApp message.
      </p>
      
      <div className="form-group">
        <label htmlFor="msg-template">Message Template</label>
        <input 
          id="msg-template" 
          type="text" 
          placeholder="Select a template..."
          value={formData.template}
          onChange={(e) => handleInputChange('template', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="msg-variables">Variables</label>
        <input 
          id="msg-variables" 
          type="text" 
          placeholder="{{name}}, {{order_id}}"
          value={formData.variables}
          onChange={(e) => handleInputChange('variables', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="msg-content">Content</label>
        <textarea 
          id="msg-content" 
          rows={4} 
          placeholder="Enter your message content..."
          value={formData.content}
          onChange={(e) => handleInputChange('content', e.target.value)}
        ></textarea>
      </div>

      <div className="back-link-wrapper">
        <button className="back-link" onClick={() => onSetView("channels")}>
          ← Back to Channels
        </button>
      </div>
    </div>
  );

  // ===============================================================
  // CONFIGURACIÓN: TEXT NODE
  // ===============================================================
  const renderTextConfig = () => (
    <div className="drawer-config">
      <p className="config-description">
        Configure your text message node.
      </p>
      
      <div className="form-group">
        <label htmlFor="text-label">Node Label</label>
        <input 
          id="text-label" 
          type="text" 
          placeholder="e.g., Welcome Message"
          value={formData.label}
          onChange={(e) => handleInputChange('label', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="text-content">Message Content</label>
        <textarea 
          id="text-content" 
          rows={5} 
          placeholder="Enter the text message to send..."
          value={formData.content}
          onChange={(e) => handleInputChange('content', e.target.value)}
        ></textarea>
      </div>

      <div className="form-group">
        <label htmlFor="text-delay">Delay (seconds)</label>
        <input 
          id="text-delay" 
          type="number" 
          placeholder="0"
          min="0"
          value={formData.delay}
          onChange={(e) => handleInputChange('delay', parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="back-link-wrapper">
        <button className="back-link" onClick={() => onSetView("flow")}>
          ← Back to Flow
        </button>
      </div>
    </div>
  );

  // ===============================================================
  // CONFIGURACIÓN: OPTIONS NODE
  // ===============================================================
  const renderOptionsConfig = () => (
    <div className="drawer-config">
      <p className="config-description">
        Configure interactive button options.
      </p>
      
      <div className="form-group">
        <label htmlFor="options-label">Node Label</label>
        <input 
          id="options-label" 
          type="text" 
          placeholder="e.g., Choose an option"
          value={formData.label}
          onChange={(e) => handleInputChange('label', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="options-question">Question Text</label>
        <textarea 
          id="options-question" 
          rows={3} 
          placeholder="What would you like to do?"
          value={formData.question}
          onChange={(e) => handleInputChange('question', e.target.value)}
        ></textarea>
      </div>

      <div className="form-group">
        <label>Button Options</label>
        <div className="options-list">
          {formData.options.map((option, index) => (
            <input 
              key={index}
              type="text" 
              placeholder={`Option ${index + 1}`}
              className="option-input"
              value={option}
              onChange={(e) => {
                const newOptions = [...formData.options];
                newOptions[index] = e.target.value;
                handleInputChange('options', newOptions);
              }}
            />
          ))}
          <button 
            className="add-option-btn"
            onClick={() => handleInputChange('options', [...formData.options, ''])}
          >
            + Add Option
          </button>
        </div>
      </div>

      <div className="back-link-wrapper">
        <button className="back-link" onClick={() => onSetView("flow")}>
          ← Back to Flow
        </button>
      </div>
    </div>
  );

  // ===============================================================
  // CONFIGURACIÓN: MEDIA NODE
  // ===============================================================
  const renderMediaConfig = () => (
    <div className="drawer-config">
      <p className="config-description">
        Configure media attachments (images, videos, files).
      </p>
      
      <div className="form-group">
        <label htmlFor="media-label">Node Label</label>
        <input 
          id="media-label" 
          type="text" 
          placeholder="e.g., Send Image"
          value={formData.label}
          onChange={(e) => handleInputChange('label', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="media-type">Media Type</label>
        <select 
          id="media-type"
          value={formData.mediaType}
          onChange={(e) => handleInputChange('mediaType', e.target.value)}
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
          <option value="audio">Audio</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="media-url">Media URL</label>
        <input 
          id="media-url" 
          type="text" 
          placeholder="https://example.com/image.jpg"
          value={formData.mediaUrl}
          onChange={(e) => handleInputChange('mediaUrl', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="media-caption">Caption (Optional)</label>
        <textarea 
          id="media-caption" 
          rows={3} 
          placeholder="Add a caption for the media..."
          value={formData.caption}
          onChange={(e) => handleInputChange('caption', e.target.value)}
        ></textarea>
      </div>

      <div className="back-link-wrapper">
        <button className="back-link" onClick={() => onSetView("flow")}>
          ← Back to Flow
        </button>
      </div>
    </div>
  );

  // ===============================================================
  // TÍTULO DINÁMICO
  // ===============================================================
  const getTitle = () => {
    switch (view) {
      case 'configuring-whatsapp':
        return 'Configure WhatsApp Node';
      case 'configuring-text':
        return 'Configure Text Node';
      case 'configuring-options':
        return 'Configure Options Node';
      case 'configuring-media':
        return 'Configure Media Node';
      case 'main':
        return 'What happens next?';
      case 'channels':
        return 'Select a Channel';
      case 'flow':
        return 'Select Flow Action';
      case 'ai':
        return 'Select AI Tool';
      case 'core':
        return 'Select Core Action';
      default:
        return 'Configure Node';
    }
  };

  // ===============================================================
  // RENDER PRINCIPAL
  // ===============================================================
  return (
    <div className={`drawer-left ${open ? "open" : ""}`}>
      <div className="drawer-header">
        <h3>{getTitle()}</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      <div className="drawer-search">
        <input type="text" placeholder="Search nodes..." />
      </div>
      
      {/* Renderizado condicional basado en la vista */}
      {view === 'main' && renderMainMenu()}
      {view === 'channels' && renderChannelsMenu()}
      {view === 'flow' && renderFlowMenu()}
      {view === 'ai' && renderAIMenu()}
      {view === 'core' && renderCoreMenu()}
      {view === 'configuring-whatsapp' && renderWhatsAppConfig()}
      {view === 'configuring-text' && renderTextConfig()}
      {view === 'configuring-options' && renderOptionsConfig()}
      {view === 'configuring-media' && renderMediaConfig()}
    </div>
  );
};

export default Drawer;