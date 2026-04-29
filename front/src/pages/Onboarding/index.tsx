// src/pages/Onboarding/index.tsx
// Asistente IA estilo ChatGPT

import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { callOpenAI } from '../../services/openaiService';
import { env } from '../../env';

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isTyping?: boolean;
    showSendToDIANButton?: boolean; // Botón para enviar a DIAN
}

const OnboardingPage: React.FC = () => {
    const [chatMessage, setChatMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAiTyping, setIsAiTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll automático al final de los mensajes
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        document.title = "Asistente IA | Bolti";
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Simular respuesta de IA con efecto de typing
    const simulateAiResponse = (fullResponse: string, showSendButton: boolean = false) => {
        setIsAiTyping(true);

        const newMessageId = Date.now();

        // Agregar mensaje vacío de la IA
        setMessages(prev => [...prev, {
            id: newMessageId,
            role: 'assistant',
            content: '',
            isTyping: true,
            showSendToDIANButton: false
        }]);

        let currentIndex = 0;

        // Efecto de typing carácter por carácter
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
                        ? { ...msg, isTyping: false, showSendToDIANButton: showSendButton }
                        : msg
                ));
            }
        }, 20); // 20ms por carácter
    };

    // Respuestas simuladas del asistente (sin OpenAI)

    // Función para ejecutar el Set de Pruebas
    const executeTestSet = async (): Promise<string> => {
        try {
            // Verificar que la API esté configurada
            const apiUrl = api.defaults.baseURL || env.API_URL;
            if (!apiUrl) {
                return `❌ Error de configuración: No se encontró la URL del servidor backend.\n\nPor favor, verifica que el archivo \`.env\` en la carpeta \`front/\` contenga:\nVITE_API_URL=${env.API_URL}\n\nLuego reinicia el servidor de desarrollo.`;
            }
            
            const response = await api.post('/aliaddo/test-set/generate');
            if (response.data.success) {
                // Si ya existe y está ENVIADO o APROBADO
                if (response.data.alreadyExists) {
                    const status = response.data.status || 'COMPLETADO';
                    const summary = response.data.summary || {};
                    const facturas = summary.facturas || { created: 0, required: 8 };
                    const notasCredito = summary.notasCredito || { created: 0, required: 1 };
                    const notasDebito = summary.notasDebito || { created: 0, required: 1 };
                    const total = summary.total || { created: 0, required: 10 };
                    
                    // Usar existing si está disponible, sino usar created
                    const facturasCount = facturas.existing !== undefined ? facturas.existing : facturas.created;
                    const notasCreditoCount = notasCredito.existing !== undefined ? notasCredito.existing : notasCredito.created;
                    const notasDebitoCount = notasDebito.existing !== undefined ? notasDebito.existing : notasDebito.created;
                    const totalCount = total.existing !== undefined ? total.existing : total.created;
                    
                    let message = '';
                    if (status === 'ENVIADO') {
                        message = `📤 **Set de Pruebas ya enviado a la DIAN**\n\nEl Set de Pruebas ya fue enviado a la DIAN y está en revisión. No se pueden crear nuevos documentos de prueba.\n\n📊 Documentos enviados:\n• Facturas: ${facturasCount}/${facturas.required}\n• Notas Crédito: ${notasCreditoCount}/${notasCredito.required}\n• Notas Débito: ${notasDebitoCount}/${notasDebito.required}\n• Total: ${totalCount}/${total.required} documentos\n\n⏳ **Estado:** En revisión por la DIAN\n\n💡 Mientras esperas la aprobación, puedes seguir probando en modo sandbox.`;
                    } else if (status === 'APROBADO') {
                        message = `✅ **Set de Pruebas aprobado**\n\nEl Set de Pruebas ya fue aprobado por la DIAN. Ya puedes facturar en producción.\n\n📊 Documentos aprobados:\n• Facturas: ${facturasCount}/${facturas.required}\n• Notas Crédito: ${notasCreditoCount}/${notasCredito.required}\n• Notas Débito: ${notasDebitoCount}/${notasDebito.required}\n• Total: ${totalCount}/${total.required} documentos\n\n🎉 **Estado:** Aprobado - Ya puedes facturar en producción`;
                    } else {
                        // COMPLETADO pero no ENVIADO
                        message = `ℹ️ **Set de Pruebas ya completo**\n\n${response.data.message || 'El Set de Pruebas ya está completo.'}\n\n📊 Documentos existentes:\n• Facturas: ${facturasCount}/${facturas.required}\n• Notas Crédito: ${notasCreditoCount}/${notasCredito.required}\n• Notas Débito: ${notasDebitoCount}/${notasDebito.required}\n• Total: ${totalCount}/${total.required} documentos\n\n📤 ¿Quieres enviar el Set de Pruebas a la DIAN ahora?`;
                    }
                    return message;
                }
                
                // Si se crearon documentos nuevos
                const summary = response.data.summary || {};
                const facturas = summary.facturas || { created: 0, required: 8, existing: 0 };
                const notasCredito = summary.notasCredito || { created: 0, required: 1, existing: 0 };
                const notasDebito = summary.notasDebito || { created: 0, required: 1, existing: 0 };
                const total = summary.total || { created: 0, required: 10, existing: 0 };
                
                const totalCreated = total.created || 0;
                const totalRequired = total.required || 10;
                const totalExisting = total.existing || 0;
                
                // Mostrar documentos creados y existentes
                const facturasTotal = (facturas.existing || 0) + facturas.created;
                const notasCreditoTotal = (notasCredito.existing || 0) + notasCredito.created;
                const notasDebitoTotal = (notasDebito.existing || 0) + notasDebito.created;
                const totalTotal = totalExisting + totalCreated;
                
                let message = `✅ **Set de Pruebas generado!**\n\n📊 Resumen:\n• Facturas: ${facturasTotal}/${facturas.required}${facturas.created > 0 ? ` (${facturas.created} nuevas)` : ''}\n• Notas Crédito: ${notasCreditoTotal}/${notasCredito.required}${notasCredito.created > 0 ? ` (${notasCredito.created} nuevas)` : ''}\n• Notas Débito: ${notasDebitoTotal}/${notasDebito.required}${notasDebito.created > 0 ? ` (${notasDebito.created} nuevas)` : ''}\n• Total: ${totalTotal}/${totalRequired} documentos${totalCreated > 0 ? ` (${totalCreated} nuevos)` : ''}\n\n`;
                
                if (totalTotal === totalRequired) {
                    message += '🎉 ¡Todos los documentos fueron creados correctamente!\n\n📤 ¿Quieres enviar el Set de Pruebas a la DIAN ahora?';
                } else if (totalCreated > 0) {
                    message += `⚠️ Se crearon ${totalCreated} de ${totalRequired - totalExisting} documentos faltantes. `;
                    if (response.data.errors && response.data.errors.length > 0) {
                        message += `\n\n❌ Errores encontrados:\n${response.data.errors.slice(0, 5).map((e: string) => `• ${e}`).join('\n')}`;
                        if (response.data.errors.length > 5) {
                            message += `\n... y ${response.data.errors.length - 5} errores más.`;
                        }
                    }
                    message += '\n\n💡 Revisa la consola del servidor para más detalles y vuelve a intentar.';
                } else {
                    message += '❌ No se pudieron crear documentos. ';
                    if (response.data.errors && response.data.errors.length > 0) {
                        message += `\n\nErrores:\n${response.data.errors.slice(0, 5).map((e: string) => `• ${e}`).join('\n')}`;
                    } else {
                        message += '\n\n💡 Posibles causas:\n• La empresa no está registrada en Aliaddo\n• Faltan datos fiscales de la empresa\n• Error de conexión con la base de datos\n\nRevisa la consola del servidor backend para ver los errores detallados.';
                    }
                }
                
                return message;
            } else {
                return `❌ Error al generar el Set de Pruebas: ${response.data.message || 'Error desconocido'}\n\n💡 Revisa la consola del servidor para más detalles.`;
            }
        } catch (error: any) {
            console.error('Error ejecutando Set de Pruebas:', error);
            
            // Detectar tipo de error
            let errorMessage = '';
            if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
                const apiUrl = api.defaults.baseURL || env.API_URL;
                errorMessage = `❌ Error de conexión: No se pudo conectar al servidor backend.\n\n💡 Verifica:\n• Que el servidor backend esté corriendo en ${apiUrl}\n• Abre una terminal y ejecuta: cd back && npm run dev\n• Verifica que el puerto 3000 esté disponible\n• Revisa la consola del navegador (F12) para más detalles`;
            } else if (error.response?.status === 401) {
                errorMessage = `❌ Error de autenticación: Tu sesión ha expirado.\n\n💡 Por favor, cierra sesión y vuelve a iniciar sesión.`;
            } else if (error.response?.status === 403) {
                errorMessage = `❌ Error de permisos: No tienes permisos para crear documentos.\n\n💡 Contacta al administrador del sistema.`;
            } else {
                errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
                errorMessage = `❌ Error al ejecutar el Set de Pruebas: ${errorMessage}\n\n💡 Verifica:\n• Que el servidor backend esté corriendo\n• Revisa la consola del servidor para más detalles`;
            }
            
            return errorMessage;
        }
    };

    // Función para enviar el Set de Pruebas a la DIAN
    const sendTestSetToDIAN = async (): Promise<string> => {
        try {
            const response = await api.post('/aliaddo/test-set/send');
            if (response.data.success) {
                return `✅ **Set de Pruebas enviado a la DIAN!**\n\n${response.data.message || 'El Set de Pruebas ha sido enviado correctamente.'}\n\n📋 **Estado:** ${response.data.status || 'ENVIADO'}\n\n💡 Ahora puedes seguir probando en modo sandbox mientras esperas la aprobación de la DIAN. Una vez aprobado, podrás facturar en producción.`;
            } else {
                return `❌ Error al enviar el Set de Pruebas: ${response.data.message || 'Error desconocido'}\n\n💡 Revisa la consola del servidor para más detalles.`;
            }
        } catch (error: any) {
            console.error('Error enviando Set de Pruebas a DIAN:', error);
            
            let errorMessage = '';
            if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
                errorMessage = `❌ Error de conexión: No se pudo conectar al servidor backend.\n\n💡 Verifica que el servidor backend esté corriendo.`;
            } else if (error.response?.status === 400) {
                errorMessage = `❌ ${error.response.data?.message || 'El Set de Pruebas no está completo o hay un problema con la configuración.'}\n\n💡 Verifica que todos los documentos estén creados y que tu empresa esté registrada en Aliaddo.`;
            } else if (error.response?.status === 401) {
                errorMessage = `❌ Error de autenticación: Tu sesión ha expirado.\n\n💡 Por favor, cierra sesión y vuelve a iniciar sesión.`;
            } else {
                errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
                errorMessage = `❌ Error al enviar el Set de Pruebas: ${errorMessage}\n\n💡 Revisa la consola del servidor para más detalles.`;
            }
            
            return errorMessage;
        }
    };

    // Prompt del sistema para el asistente de IA
    const systemPrompt = `Eres Bolti, un asistente de contabilidad con IA especializado en ayudar a emprendedores y contadores en Colombia.

Tu función es ayudar con:
- Crear facturas electrónicas (integradas con DIAN)
- Generar notas crédito y débito
- Preparar nómina electrónica
- Consultar reportes y estados financieros
- **Generar y ejecutar el Set de Pruebas DIAN** (necesario para empezar a facturar)

IMPORTANTE: 
- Si el usuario pide "generar set de pruebas", "ejecutar set de pruebas", "set de pruebas dian", etc., debes indicarle que ejecutarás esa acción específica, pero NO la ejecutes directamente (el sistema lo hará automáticamente).
- Si el usuario quiere "enviar a dian" o "enviar set de pruebas a dian", también es una acción específica que el sistema manejará.

Sé amigable, profesional y conciso. Usa emojis moderadamente. Responde en español colombiano.`;

    // Función para obtener respuesta de OpenAI o ejecutar acciones
    const getAiResponse = async (userMessage: string): Promise<string> => {
        const lowerMsg = userMessage.toLowerCase().trim();

        // Detectar si el usuario quiere enviar el Set de Pruebas a DIAN
        const sendToDIANKeywords = [
            'enviar a dian', 'enviar dian', 'enviar set', 'mandar a dian',
            'enviar pruebas', 'enviar set de pruebas', 'enviar set pruebas',
            'enviar a revisión', 'enviar revisión', 'mandar revisión'
        ];
        
        const hasSendToDIANKeyword = sendToDIANKeywords.some(keyword => lowerMsg.includes(keyword));
        const hasEnviarAndDIAN = (lowerMsg.includes('enviar') || lowerMsg.includes('mandar')) && 
                                  (lowerMsg.includes('dian') || lowerMsg.includes('revisión'));
        
        // Detectar respuestas afirmativas simples (solo si el último mensaje fue sobre enviar a DIAN)
        const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
        const lastMessageWasAboutSending = lastAssistantMessage?.content?.includes('¿Quieres enviar el Set de Pruebas a la DIAN ahora?');
        
        const affirmativeResponses = ['si', 'sí', 'ok', 'dale', 'adelante', 'vamos', 'hazlo', 'procede', 'claro', 'por supuesto', 'enviar', 'envía', 'sí quiero', 'si quiero'];
        const isAffirmativeResponse = affirmativeResponses.some(response => lowerMsg === response || lowerMsg.startsWith(response + ' '));

        // Si el usuario quiere enviar a DIAN, ejecutarlo
        if (hasSendToDIANKeyword || hasEnviarAndDIAN || (isAffirmativeResponse && lastMessageWasAboutSending)) {
            return await sendTestSetToDIAN();
        }

        // Detectar si el usuario quiere ejecutar el Set de Pruebas
        const testSetKeywords = [
            'set de pruebas', 'set de prueba', 'set pruebas',
            'generar set', 'ejecutar set', 'correr set', 'crear set',
            'pruebas dian', 'prueba dian', 'set dian',
            'empezar a facturar', 'comenzar a facturar', 'iniciar facturación',
            'habilitar facturación', 'activar facturación'
        ];
        
        const hasTestSetKeyword = testSetKeywords.some(keyword => lowerMsg.includes(keyword));
        const hasPruebasAndAction = lowerMsg.includes('pruebas') && (
            lowerMsg.includes('generar') || lowerMsg.includes('ejecutar') || 
            lowerMsg.includes('correr') || lowerMsg.includes('crear') ||
            lowerMsg.includes('hacer') || lowerMsg.includes('realizar')
        );

        // Si el usuario quiere ejecutar el Set de Pruebas, ejecutarlo realmente
        if (hasTestSetKeyword || hasPruebasAndAction) {
            return await executeTestSet();
        }

        // Para otras consultas, usar OpenAI
        try {
            const messagesForOpenAI = [
                { role: 'system' as const, content: systemPrompt },
                ...messages.slice(-5).map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
                    content: msg.content
                })),
                { role: 'user' as const, content: userMessage }
            ];

            const response = await callOpenAI(messagesForOpenAI, 'gpt-4o-mini', 0.7);
            return response;
        } catch (error: any) {
            console.error('Error con OpenAI:', error);
            // Fallback a respuesta simple si falla OpenAI
            return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo o escribe "generar set de pruebas" para comenzar con el Set de Pruebas DIAN.';
        }
    };

    const handleChatSubmit = async () => {
        if (!chatMessage.trim() || isAiTyping) return;

        // Agregar mensaje del usuario
        const userMsg: ChatMessage = {
            id: Date.now(),
            role: 'user',
            content: chatMessage.trim()
        };

        setMessages(prev => [...prev, userMsg]);
        const currentMessage = chatMessage.trim();
        setChatMessage('');

        // Obtener respuesta de IA (puede ser asíncrona)
        try {
            const aiResponse = await getAiResponse(currentMessage);
            // Detectar si el mensaje es sobre generar set de pruebas y está completo o si debe mostrar botón
            const isTestSetComplete = aiResponse.includes('🎉 ¡Todos los documentos fueron creados correctamente!') ||
                                     aiResponse.includes('📤 ¿Quieres enviar el Set de Pruebas a la DIAN ahora?') ||
                                     (aiResponse.includes('Set de Pruebas ya completo') && aiResponse.includes('📤 ¿Quieres enviar'));
            simulateAiResponse(aiResponse, isTestSetComplete);
        } catch (error: any) {
            console.error('Error en handleChatSubmit:', error);
            simulateAiResponse('Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.');
        }
    };

    return (
        <div className="page-content">
            <div style={styles.container}>
                {/* Área de mensajes / contenido central */}
                <div style={styles.chatArea}>
                    {/* Estado vacío - centrado verticalmente */}
                    {messages.length === 0 && (
                        <div style={styles.emptyState}>
                            <div style={styles.emptyIcon}>✨</div>
                            <h1 style={styles.emptyTitle}>¿En qué puedo ayudarte hoy?</h1>
                            <p style={styles.emptySubtitle}>Soy tu asistente de Bolti. Puedo crear facturas, generar nóminas, ejecutar el Set de Pruebas DIAN y más.</p>

                            {/* Sugerencias */}
                            <div style={styles.suggestions}>
                                <button
                                    style={styles.suggestionBtn}
                                    onClick={async () => {
                                        const testSetMessage = 'Generar set de pruebas';
                                        const userMsg: ChatMessage = {
                                            id: Date.now(),
                                            role: 'user',
                                            content: testSetMessage
                                        };
                                        setMessages(prev => [...prev, userMsg]);
                                        try {
                                            const aiResponse = await getAiResponse(testSetMessage);
                                            simulateAiResponse(aiResponse);
                                        } catch (error: any) {
                                            console.error('Error ejecutando Set de Pruebas:', error);
                                            simulateAiResponse('Lo siento, hubo un error al ejecutar el Set de Pruebas. Por favor, intenta de nuevo.');
                                        }
                                    }}
                                >
                                    🚀 Generar Set de Pruebas DIAN
                                </button>
                                <button
                                    style={styles.suggestionBtn}
                                    onClick={() => setChatMessage('Créame una factura para Carlos Roa')}
                                >
                                    📄 Crear factura
                                </button>
                                <button
                                    style={styles.suggestionBtn}
                                    onClick={() => setChatMessage('Necesito generar la nómina de este mes')}
                                >
                                    💰 Generar nómina
                                </button>
                                <button
                                    style={styles.suggestionBtn}
                                    onClick={() => setChatMessage('¿Cuánto he vendido este mes?')}
                                >
                                    📊 Ventas del mes
                                </button>
                                <button
                                    style={styles.suggestionBtn}
                                    onClick={() => setChatMessage('Crea un estado financiero actual de mi negocio')}
                                >
                                    📈 Estado financiero
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Mensajes de la conversación */}
                    {messages.length > 0 && (
                        <div style={styles.messagesContainer}>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        ...styles.messageRow,
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    {msg.role === 'assistant' && (
                                        <div style={styles.aiAvatar}>✨</div>
                                    )}
                                    <div style={{
                                        ...styles.messageBubble,
                                        ...(msg.role === 'user' ? styles.userBubble : styles.aiBubble)
                                    }}>
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                        {msg.isTyping && <span style={styles.cursor}>|</span>}
                                        {msg.showSendToDIANButton && !msg.isTyping && (
                                            <div style={styles.buttonContainer}>
                                                <button
                                                    style={styles.sendToDIANButton}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1.02)';
                                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.transform = 'scale(1)';
                                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.3)';
                                                    }}
                                                    onClick={async () => {
                                                        // Agregar mensaje del usuario
                                                        const userMsg: ChatMessage = {
                                                            id: Date.now(),
                                                            role: 'user',
                                                            content: 'Enviar a DIAN'
                                                        };
                                                        setMessages(prev => [...prev, userMsg]);
                                                        
                                                        try {
                                                            const aiResponse = await sendTestSetToDIAN();
                                                            simulateAiResponse(aiResponse);
                                                        } catch (error: any) {
                                                            console.error('Error enviando a DIAN:', error);
                                                            simulateAiResponse('Lo siento, hubo un error al enviar el Set de Pruebas. Por favor, intenta de nuevo.');
                                                        }
                                                    }}
                                                >
                                                    📤 Enviar a DIAN
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input fijo abajo */}
                <div style={styles.inputWrapper}>
                    <div style={styles.inputContainer}>
                        {/* Botón de adjuntar documento */}
                        <button
                            style={styles.attachBtn}
                            onClick={() => {
                                // TODO: Implementar carga de documentos
                                alert('📎 Función de adjuntar documentos próximamente');
                            }}
                            title="Adjuntar documento"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </button>

                        <textarea
                            style={styles.chatInput}
                            placeholder="Pregunta lo que quieras..."
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
                                ...styles.sendBtn,
                                opacity: chatMessage.trim() && !isAiTyping ? 1 : 0.4
                            }}
                            onClick={handleChatSubmit}
                            disabled={!chatMessage.trim() || isAiTyping}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </div>
                    {isAiTyping && (
                        <div style={styles.typingText}>✨ escribiendo...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================
// ESTILOS - Diseño estilo ChatGPT
// ============================================
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 130px)',
        background: 'transparent',
        position: 'relative'
    },
    chatArea: {
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px'
    },
    emptyState: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px'
    },
    emptyIcon: {
        fontSize: '56px',
        marginBottom: '16px'
    },
    emptyTitle: {
        fontSize: '32px',
        fontWeight: 800,
        color: '#1A1D1F',
        margin: '0 0 12px 0',
        letterSpacing: '-0.02em'
    },
    emptySubtitle: {
        fontSize: '15px',
        color: '#6F767E',
        margin: '0 0 32px 0',
        maxWidth: '450px',
        lineHeight: 1.6
    },
    suggestions: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        justifyContent: 'center'
    },
    suggestionBtn: {
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        background: 'white',
        border: 'none',
        borderRadius: '9999px',
        cursor: 'pointer',
        color: '#1A1D1F',
        transition: 'all 0.2s',
        boxShadow: '0px 2px 8px rgba(0,0,0,0.04), 0px 0px 1px rgba(0,0,0,0.06)'
    },
    messagesContainer: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '800px',
        width: '100%',
        margin: '0 auto',
        paddingBottom: '20px'
    },
    messageRow: {
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start'
    },
    aiAvatar: {
        width: '32px',
        height: '32px',
        borderRadius: '14px',
        background: '#1A1D1F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        flexShrink: 0,
        color: 'white'
    },
    messageBubble: {
        padding: '14px 18px',
        borderRadius: '24px',
        maxWidth: '70%',
        whiteSpace: 'pre-wrap',
        fontSize: '14px',
        lineHeight: 1.6
    },
    userBubble: {
        background: '#1A1D1F',
        color: 'white',
        borderBottomRightRadius: '8px'
    },
    aiBubble: {
        background: 'white',
        color: '#1A1D1F',
        borderBottomLeftRadius: '8px',
        boxShadow: '0px 2px 8px rgba(0,0,0,0.04), 0px 0px 1px rgba(0,0,0,0.06)'
    },
    cursor: {
        fontWeight: 'bold',
        animation: 'blink 1s infinite'
    },
    inputWrapper: {
        padding: '16px 20px 24px',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
    },
    inputContainer: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '12px',
        background: 'white',
        border: 'none',
        borderRadius: '24px',
        padding: '14px 18px',
        width: '100%',
        maxWidth: '800px',
        boxShadow: '0px 2px 8px rgba(0,0,0,0.04), 0px 0px 1px rgba(0,0,0,0.06)'
    },
    attachBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: 'none',
        background: 'transparent',
        color: '#6F767E',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s'
    },
    chatInput: {
        flex: 1,
        border: 'none',
        background: 'transparent',
        fontSize: '15px',
        resize: 'none',
        outline: 'none',
        minHeight: '24px',
        maxHeight: '150px',
        fontFamily: 'inherit',
        color: '#1A1D1F',
        lineHeight: 1.5
    },
    sendBtn: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: 'none',
        background: '#1A1D1F',
        color: 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s'
    },
    typingText: {
        fontSize: '12px',
        color: '#8B5CF6',
        fontWeight: 600
    },
    buttonContainer: {
        marginTop: '12px',
        display: 'flex',
        justifyContent: 'flex-start'
    },
    sendToDIANButton: {
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 600,
        background: '#1A1D1F',
        color: 'white',
        border: 'none',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0px 4px 12px rgba(0,0,0,0.12)'
    }
};

export default OnboardingPage;
