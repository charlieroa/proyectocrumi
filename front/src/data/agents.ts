import avatar1 from '../assets/imagenes/1.png';
import avatar2 from '../assets/imagenes/2.png';
import avatar3 from '../assets/imagenes/3.png';
import avatar4 from '../assets/imagenes/4.png';
import avatar5 from '../assets/imagenes/5.png';
import avatar6 from '../assets/imagenes/6.png';
import avatar7 from '../assets/imagenes/7.png';

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  ring: string;
  pillBg: string;
  gradient: string;
  description: string;
  longDescription: string;
  specialties: string[];
  prompt: string;
}

export const agents: Agent[] = [
  {
    id: 'general',
    name: 'Santiago',
    role: 'Asistente Bolti',
    avatar: avatar7,
    ring: 'ring-slate-400',
    pillBg: 'bg-slate-600',
    gradient: 'from-slate-500 to-slate-700',
    description: 'Pideme lo que necesites: crea facturas, registra pagos, consulta tu balance, revisa impuestos, gestiona nomina o preguntame lo que quieras.',
    longDescription: 'Santiago es tu asistente principal en Bolti. Escribe en lenguaje natural y el se encarga: "crea factura cliente X por $500.000", "muestrame el balance general", "registra pago de proveedor", "cuanto debo de IVA". Conecta con todos los agentes especializados para ejecutar cualquier tarea contable, comercial, de nomina o legal.',
    specialties: ['Crear facturas', 'Ver balances', 'Registrar pagos', 'Consultar impuestos', 'Gestionar nomina', 'Preguntar lo que sea'],
    prompt: '¿Que puedo pedirte? Dame ejemplos de lo que sabes hacer',
  },
  {
    id: 'ventas',
    name: 'Alejandro',
    role: 'Agente de Ventas',
    avatar: avatar1,
    ring: 'ring-violet-400',
    pillBg: 'bg-violet-500',
    gradient: 'from-violet-500 to-purple-600',
    description: 'Soy tu agente de ventas automatico. Creo cotizaciones, hago seguimiento a clientes, cierro negocios y gestiono todo tu proceso comercial con IA.',
    longDescription: 'Alejandro es tu agente de ventas potenciado con IA en Bolti. Automatiza cotizaciones, seguimiento de prospectos, cierre de negocios y gestion de clientes. Trabaja 24/7 para que no pierdas ninguna oportunidad de venta. Genera propuestas comerciales, analiza el pipeline y te avisa cuando un cliente necesita atencion.',
    specialties: ['Cotizaciones automaticas', 'Seguimiento de prospectos', 'Pipeline de ventas', 'Cierre de negocios', 'Gestion de clientes', 'Propuestas comerciales'],
    prompt: '¿Como puedo automatizar mis ventas con Bolti?',
  },
  {
    id: 'contador',
    name: 'Pedro',
    role: 'Contador Experto',
    avatar: avatar3,
    ring: 'ring-emerald-400',
    pillBg: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-emerald-600',
    description: 'Tu contador experto con IA. Manejo registros contables, conciliaciones, estados financieros y te ayudo a tomar decisiones basadas en tus numeros.',
    longDescription: 'Pedro es tu agente contador experto en Bolti. Lleva la contabilidad de tu empresa de forma automatica: registros contables, conciliaciones bancarias, estados financieros, plan de cuentas, balance general y estado de resultados. Analiza tus numeros y te da recomendaciones financieras en tiempo real.',
    specialties: ['Estados financieros', 'Conciliaciones bancarias', 'Registros contables', 'Plan de cuentas', 'Balance general', 'Analisis financiero'],
    prompt: '¿Cual es mi situacion contable actual?',
  },
  {
    id: 'nomina',
    name: 'Yenny',
    role: 'Agente de Nomina',
    avatar: avatar2,
    ring: 'ring-amber-400',
    pillBg: 'bg-amber-500',
    gradient: 'from-amber-500 to-amber-600',
    description: 'Tu agente de nomina y talento humano. Automatizo liquidaciones, prestaciones y toda la gestion de personal de tu empresa.',
    longDescription: 'Yenny es tu agente de nomina en Bolti. Automatiza calculos salariales, prestaciones sociales, liquidaciones, seguridad social y parafiscales. Mantiene tu nomina al dia y te asegura cumplir con todas las obligaciones laborales sin errores.',
    specialties: ['Calculo de nomina', 'Prestaciones sociales', 'Liquidaciones', 'Seguridad social', 'Parafiscales', 'Vacaciones y cesantias'],
    prompt: 'Genera el reporte de nomina del mes actual',
  },
  {
    id: 'auditor',
    name: 'Carlos',
    role: 'Agente Auditor',
    avatar: avatar5,
    ring: 'ring-indigo-400',
    pillBg: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-indigo-600',
    description: 'Tu agente auditor. Reviso procesos, identifico riesgos y aseguro que tu empresa cumpla con la normativa vigente.',
    longDescription: 'Carlos es tu agente auditor en Bolti. Revisa automaticamente procesos internos, identifica riesgos, verifica cumplimiento normativo y genera alertas cuando algo necesita atencion. Mantiene los controles internos de tu empresa solidos y actualizados.',
    specialties: ['Auditoria interna', 'Control interno', 'Gestion de riesgos', 'Cumplimiento normativo', 'Alertas automaticas', 'Informes de auditoria'],
    prompt: '¿Como estan mis controles internos y cumplimiento?',
  },
  {
    id: 'tributario',
    name: 'Maria',
    role: 'Agente Tributario',
    avatar: avatar4,
    ring: 'ring-rose-400',
    pillBg: 'bg-rose-500',
    gradient: 'from-rose-500 to-rose-600',
    description: 'Tu agente tributario. Gestiono impuestos, declaraciones y planeacion fiscal para que pagues lo justo sin riesgos.',
    longDescription: 'Maria es tu agente tributario en Bolti. Automatiza la gestion de impuestos, declaraciones de renta, IVA, ICA, retenciones y planeacion tributaria. Te avisa de fechas limite, calcula obligaciones y optimiza tu carga fiscal dentro del marco legal colombiano.',
    specialties: ['Declaracion de renta', 'IVA e ICA', 'Retencion en la fuente', 'Planeacion tributaria', 'Alertas de vencimiento', 'Facturacion electronica'],
    prompt: '¿Cuales son mis obligaciones tributarias pendientes?',
  },
  {
    id: 'legal',
    name: 'Ana',
    role: 'Agente Legal',
    avatar: avatar6,
    ring: 'ring-sky-400',
    pillBg: 'bg-sky-500',
    gradient: 'from-sky-500 to-sky-600',
    description: 'Tu agente legal. Te asesoro en contratos, normativa empresarial y proteccion legal de tu negocio.',
    longDescription: 'Ana es tu agente legal en Bolti. Te asesora en contratos comerciales, derecho laboral, proteccion de datos, registro mercantil y normativa empresarial. Revisa documentos, identifica riesgos legales y te mantiene protegido ante cualquier situacion juridica.',
    specialties: ['Contratos comerciales', 'Derecho laboral', 'Proteccion de datos', 'Registro mercantil', 'Revision de documentos', 'Normativa empresarial'],
    prompt: '¿Que aspectos legales debo tener en cuenta para mi empresa?',
  },
];
