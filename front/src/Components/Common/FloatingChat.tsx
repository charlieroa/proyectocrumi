// src/Components/Common/FloatingChat.tsx
// Mini-chat flotante estilo ChatGPT que aparece desde el botón de la esquina

import React, { useState, useEffect, useRef } from 'react';
import {
    Offcanvas,
    OffcanvasHeader,
    OffcanvasBody,
} from "reactstrap";

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
}

interface FloatingChatProps {
    isOpen: boolean;
    toggle: () => void;
}

const FloatingChat: React.FC<FloatingChatProps> = ({ isOpen, toggle }) => {
    const [chatMessage, setChatMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll automático
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Simular respuesta de IA
    const simulateAiResponse = (fullResponse: string) => {
        setIsAiTyping(true);
        const newMessageId = Date.now();

        setMessages(prev => [...prev, {
            id: newMessageId,
            role: 'assistant',
            content: '',
            isTyping: true
        }]);

        let currentIndex = 0;
        const typingInterval = setInterval(() => {
            currentIndex++;
            setMessages(prev => prev.map(msg =>
                msg.id === newMessageId
                    ? { ...msg, content: fullResponse.slice(0, currentIndex) }
                    : msg
            ));

            if (currentIndex >= fullResponse.length) {
                clearInterval(typingInterval);
                setIsAiTyping(false);
                setMessages(prev => prev.map(msg =>
                    msg.id === newMessageId
                        ? { ...msg, isTyping: false }
                        : msg
                ));
            }
        }, 15);
    };

    // Respuestas simuladas
    const getAiResponse = (userMessage: string): string => {
        const lowerMsg = userMessage.toLowerCase();

        if (lowerMsg.includes('factura')) {
            return '¡Perfecto! Voy a ayudarte a crear una factura. ¿Podrías decirme el nombre del cliente y los productos a facturar?';
        }
        if (lowerMsg.includes('nomina') || lowerMsg.includes('nómina')) {
            return 'Entendido, vamos a generar la nómina. ¿Para qué período? ¿Primera o segunda quincena?';
        }
        if (lowerMsg.includes('vendido') || lowerMsg.includes('ventas')) {
            return '📊 **Ventas del mes:**\n\n💰 Total: $12,450,000\n📄 Facturas: 23\n📈 vs mes anterior: +15%';
        }
        if (lowerMsg.includes('hola') || lowerMsg.includes('buenos') || lowerMsg.includes('buenas')) {
            return '¡Hola! Soy tu asistente de Bolti. Puedo ayudarte con facturas, nóminas, y más. ¿Qué necesitas?';
        }
        return `Entendido. Procesando: "${userMessage}"\n\n🤖 Próximamente tendré IA real.`;
    };

    const handleChatSubmit = () => {
        if (!chatMessage.trim() || isAiTyping) return;

        const userMsg: ChatMessage = {
            id: Date.now(),
            role: 'user',
            content: chatMessage.trim()
        };

        setMessages(prev => [...prev, userMsg]);
        setChatMessage('');

        setTimeout(() => {
            const aiResponse = getAiResponse(userMsg.content);
            simulateAiResponse(aiResponse);
        }, 500);
    };

    const suggestions = [
        { text: '📄 Crear factura', query: 'Créame una factura' },
        { text: '💰 Nómina', query: 'Generar nómina' },
        { text: '📊 Ventas', query: '¿Cuánto he vendido?' },
    ];

    return (
        <Offcanvas
            isOpen={isOpen}
            toggle={toggle}
            direction="end"
            className="offcanvas-end border-0"
            style={{ width: '380px' }}
        >
            <OffcanvasHeader
                className="d-flex align-items-center p-3"
                toggle={toggle}
                style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderBottom: 'none'
                }}
            >
                <span className="m-0 me-2 text-white d-flex align-items-center gap-2">
                    <span style={{ fontSize: '20px' }}>✨</span>
                    <span style={{ fontWeight: 600 }}>Asistente Bolti</span>
                </span>
            </OffcanvasHeader>

            <OffcanvasBody className="p-0 d-flex flex-column" style={{ background: '#f9fafb' }}>
                {/* Área de mensajes */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {/* Estado vacío */}
                    {messages.length === 0 && (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            padding: '20px'
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✨</div>
                            <h5 style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#111827' }}>
                                ¿En qué te ayudo?
                            </h5>
                            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#6b7280' }}>
                                Pregúntame sobre facturas, nómina, ventas...
                            </p>

                            {/* Sugerencias */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setChatMessage(s.query)}
                                        style={{
                                            padding: '8px 14px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            background: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            color: '#374151',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {s.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mensajes */}
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            style={{
                                display: 'flex',
                                gap: '10px',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            {msg.role === 'assistant' && (
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    flexShrink: 0
                                }}>
                                    ✨
                                </div>
                            )}
                            <div style={{
                                padding: '10px 14px',
                                borderRadius: '16px',
                                maxWidth: '80%',
                                whiteSpace: 'pre-wrap',
                                fontSize: '13px',
                                lineHeight: 1.5,
                                ...(msg.role === 'user' ? {
                                    background: '#111827',
                                    color: 'white',
                                    borderBottomRightRadius: '4px'
                                } : {
                                    background: 'white',
                                    color: '#111827',
                                    borderBottomLeftRadius: '4px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                })
                            }}>
                                {msg.content}
                                {msg.isTyping && <span style={{ fontWeight: 'bold' }}>|</span>}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div style={{
                    padding: '12px 16px 16px',
                    background: '#f9fafb',
                    borderTop: '1px solid #e5e7eb'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '10px',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '20px',
                        padding: '10px 14px'
                    }}>
                        <textarea
                            style={{
                                flex: 1,
                                border: 'none',
                                background: 'transparent',
                                fontSize: '14px',
                                resize: 'none',
                                outline: 'none',
                                minHeight: '20px',
                                maxHeight: '100px',
                                fontFamily: 'inherit',
                                color: '#374151'
                            }}
                            placeholder="Escribe tu mensaje..."
                            value={chatMessage}
                            onChange={e => setChatMessage(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleChatSubmit();
                                }
                            }}
                            disabled={isAiTyping}
                            rows={1}
                        />
                        <button
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: 'none',
                                background: chatMessage.trim() && !isAiTyping ? '#111827' : '#e5e7eb',
                                color: 'white',
                                cursor: chatMessage.trim() && !isAiTyping ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                            onClick={handleChatSubmit}
                            disabled={!chatMessage.trim() || isAiTyping}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </div>
                    {isAiTyping && (
                        <div style={{ fontSize: '11px', color: '#667eea', marginTop: '6px', textAlign: 'center' }}>
                            ✨ escribiendo...
                        </div>
                    )}
                </div>
            </OffcanvasBody>
        </Offcanvas>
    );
};

export default FloatingChat;
