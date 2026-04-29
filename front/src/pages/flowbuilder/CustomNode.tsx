import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FaWhatsapp } from 'react-icons/fa'; // Necesitarás instalar react-icons: npm install react-icons

/**
 * 1. Definimos la estructura de datos que nuestro nodo espera.
 * Esto es una buena práctica con TypeScript para evitar errores.
 */
export interface CustomNodeData {
  label: string;
  subtext: string;
  error?: boolean; // La propiedad 'error' es opcional
}

/**
 * 2. Creamos nuestro componente de nodo personalizado.
 * Usamos NodeProps<CustomNodeData> para que TypeScript sepa qué hay dentro de `data`.
 */
const WhatsAppNode: React.FC<NodeProps<CustomNodeData>> = ({ data }) => {
  return (
    // Contenedor principal del nodo con el estilo oscuro
    <div style={{
      background: '#3e3e3e',
      color: '#fff',
      border: `1px solid ${data.error ? '#e74c3c' : '#555'}`, // Borde rojo si hay error
      borderRadius: '8px',
      padding: '15px',
      width: '200px',
      textAlign: 'left',
      fontFamily: 'Arial, sans-serif',
      position: 'relative', // Necesario para posicionar el ícono de error
    }}>
      {/* Handle de ENTRADA a la izquierda */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#9e9e9e', width: '10px', height: '10px' }}
      />

      {/* Contenido del Nodo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Ícono de WhatsApp */}
        <FaWhatsapp size={32} style={{ color: '#25D366' }} />

        {/* Textos: Título y Subtítulo */}
        <div>
          <strong style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>
            {data.label || 'Node Label'}
          </strong>
          <small style={{ display: 'block', fontSize: '12px', color: '#aaa', marginTop: '2px' }}>
            {data.subtext || 'Node Subtext'}
          </small>
        </div>
      </div>

      {/* Indicador de Error (se muestra solo si data.error es true) */}
      {data.error && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '15px',
          color: '#e74c3c',
          fontSize: '18px',
        }}>
          ⚠️
        </div>
      )}

      {/* Handle de SALIDA a la derecha */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#9e9e9e', width: '10px', height: '10px' }}
      />
    </div>
  );
};

export default WhatsAppNode;