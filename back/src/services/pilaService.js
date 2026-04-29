// src/services/pilaService.js
// Servicio para generación de PILA (Planilla Integrada de Liquidación de Aportes)
// Formato de archivo plano para operadores SOI / Aportes en Línea
// Colombia - Resolución 2388 de 2016 y normativa vigente

// =============================================
// CONSTANTES DE SUBSISTEMAS PILA
// =============================================

/** Porcentajes legales por subsistema de seguridad social (2024-2026) */
const PILA_RATES = {
    SALUD: {
        TOTAL: 0.125,            // 12.5% total
        EMPLEADOR: 0.085,        // 8.5% empleador
        EMPLEADO: 0.04           // 4% empleado
    },
    PENSION: {
        TOTAL: 0.16,             // 16% total
        EMPLEADOR: 0.12,         // 12% empleador
        EMPLEADO: 0.04           // 4% empleado
    },
    ARL: {
        // Varía por clase de riesgo
        CLASE_I: 0.00522,
        CLASE_II: 0.01044,
        CLASE_III: 0.02436,
        CLASE_IV: 0.04350,
        CLASE_V: 0.06960
    },
    CCF: 0.04,                   // 4% caja de compensación
    SENA: 0.02,                  // 2% SENA
    ICBF: 0.03                   // 3% ICBF
};

/** Tipos de registro del archivo plano PILA */
const RECORD_TYPES = {
    TIPO_1: '01',    // Encabezado del archivo
    TIPO_2: '02'     // Detalle por cotizante (empleado)
};

/** Tipos de cotizante más comunes */
const TIPOS_COTIZANTE = {
    DEPENDIENTE: '01',
    SERVICIO_DOMESTICO: '02',
    INDEPENDIENTE: '03',
    PENSIONADO: '04',
    ESTUDIANTE: '21'
};

/** Subtipo de cotizante */
const SUBTIPOS_COTIZANTE = {
    NO_APLICA: '00',
    DEPENDIENTE_PENSION_COMPARTIDA: '01'
};

/** Tipos de documento para PILA */
const TIPOS_DOCUMENTO_PILA = {
    CC: 'CC',
    CE: 'CE',
    TI: 'TI',
    PA: 'PA',
    RC: 'RC',
    NIT: 'NI',
    PEP: 'PE'
};

// =============================================
// DEFINICIONES DE SUBSISTEMAS
// =============================================

/**
 * Retorna las definiciones de los subsistemas del sistema de seguridad social colombiano.
 * Cada subsistema incluye su código, nombre, porcentaje y distribución empleador/empleado.
 *
 * @returns {Object[]} Array de definiciones de subsistemas
 */
const getPilaSubsystems = () => {
    return [
        {
            code: 'EPS',
            name: 'Salud (EPS)',
            description: 'Entidad Promotora de Salud',
            total_rate: PILA_RATES.SALUD.TOTAL,
            employer_rate: PILA_RATES.SALUD.EMPLEADOR,
            employee_rate: PILA_RATES.SALUD.EMPLEADO,
            ibc_field: 'ibc_health'
        },
        {
            code: 'AFP',
            name: 'Pensión (AFP)',
            description: 'Administradora de Fondo de Pensiones',
            total_rate: PILA_RATES.PENSION.TOTAL,
            employer_rate: PILA_RATES.PENSION.EMPLEADOR,
            employee_rate: PILA_RATES.PENSION.EMPLEADO,
            ibc_field: 'ibc_pension'
        },
        {
            code: 'ARL',
            name: 'Riesgos Laborales (ARL)',
            description: 'Administradora de Riesgos Laborales',
            total_rate: null, // Variable por clase de riesgo
            employer_rate: null,
            employee_rate: 0,
            risk_classes: PILA_RATES.ARL,
            ibc_field: 'ibc_arl'
        },
        {
            code: 'CCF',
            name: 'Caja de Compensación (CCF)',
            description: 'Caja de Compensación Familiar',
            total_rate: PILA_RATES.CCF,
            employer_rate: PILA_RATES.CCF,
            employee_rate: 0,
            ibc_field: 'ibc_ccf'
        },
        {
            code: 'SENA',
            name: 'SENA',
            description: 'Servicio Nacional de Aprendizaje',
            total_rate: PILA_RATES.SENA,
            employer_rate: PILA_RATES.SENA,
            employee_rate: 0,
            ibc_field: 'ibc_ccf' // Mismo IBC que CCF
        },
        {
            code: 'ICBF',
            name: 'ICBF',
            description: 'Instituto Colombiano de Bienestar Familiar',
            total_rate: PILA_RATES.ICBF,
            employer_rate: PILA_RATES.ICBF,
            employee_rate: 0,
            ibc_field: 'ibc_ccf' // Mismo IBC que CCF
        }
    ];
};

// =============================================
// CÁLCULO DEL RESUMEN PILA
// =============================================

/**
 * Calcula el resumen completo de PILA a partir de las liquidaciones de un período.
 * Agrupa aportes por subsistema y por entidad administradora.
 *
 * @param {Object[]} liquidations - Array de liquidaciones del período (payroll_liquidations rows)
 * @param {Object[]} employees - Array de empleados correspondientes
 * @param {Object[]} affiliations - Array de afiliaciones de los empleados
 * @param {Object} config - Configuración de nómina del año {smlmv, transportAllowance, uvt, ...}
 * @returns {Object} Resumen PILA completo con detalle por empleado y por entidad
 */
const calculatePilaSummary = (liquidations, employees, affiliations, config) => {
    const employeeMap = {};
    employees.forEach(e => { employeeMap[e.id] = e; });

    const affiliationMap = {};
    affiliations.forEach(a => { affiliationMap[a.employee_id] = a; });

    // Detalle por empleado
    const employeeDetails = [];

    // Acumuladores por entidad
    const byEntity = {
        eps: {},    // { code: { name, total_ibc, total_employer, total_employee, count } }
        afp: {},
        arl: {},
        ccf: {}
    };

    // Totales generales
    const totals = {
        employee_count: 0,
        // Salud
        ibc_health: 0,
        health_employer: 0,
        health_employee: 0,
        health_total: 0,
        // Pensión
        ibc_pension: 0,
        pension_employer: 0,
        pension_employee: 0,
        pension_total: 0,
        solidarity_fund: 0,
        // ARL
        ibc_arl: 0,
        arl_employer: 0,
        // CCF
        ibc_ccf: 0,
        ccf_employer: 0,
        // Parafiscales
        sena_employer: 0,
        icbf_employer: 0,
        // Gran total
        total_employer: 0,
        total_employee: 0,
        grand_total: 0
    };

    for (const liq of liquidations) {
        const employee = employeeMap[liq.employee_id];
        const affiliation = affiliationMap[liq.employee_id];

        if (!employee) continue;

        const ibcHealth = Number(liq.ibc_health || 0);
        const ibcPension = Number(liq.ibc_pension || 0);
        const ibcArl = Number(liq.ibc_arl || 0);
        const ibcCcf = Number(liq.ibc_ccf || 0);

        const healthEmployer = Number(liq.health_employer || 0);
        const healthEmployee = Number(liq.health_employee || 0);
        const pensionEmployer = Number(liq.pension_employer || 0);
        const pensionEmployee = Number(liq.pension_employee || 0);
        const solidarityFund = Number(liq.solidarity_fund || 0);
        const arlEmployer = Number(liq.arl_employer || 0);
        const ccfEmployer = Number(liq.ccf_employer || 0);
        const senaEmployer = Number(liq.sena_employer || 0);
        const icbfEmployer = Number(liq.icbf_employer || 0);

        const totalEmployerForEmployee = healthEmployer + pensionEmployer + arlEmployer +
            ccfEmployer + senaEmployer + icbfEmployer;
        const totalEmployeeDeductions = healthEmployee + pensionEmployee + solidarityFund;

        // Detalle del empleado
        employeeDetails.push({
            employee_id: employee.id,
            document_type: employee.document_type || 'CC',
            document_number: employee.document_number,
            first_name: employee.first_name,
            last_name: employee.last_name,
            tipo_cotizante: TIPOS_COTIZANTE.DEPENDIENTE,
            subtipo_cotizante: SUBTIPOS_COTIZANTE.NO_APLICA,
            worked_days: Number(liq.worked_days || 30),
            // IBCs
            ibc_health: ibcHealth,
            ibc_pension: ibcPension,
            ibc_arl: ibcArl,
            ibc_ccf: ibcCcf,
            // Salud
            health_employer: healthEmployer,
            health_employee: healthEmployee,
            health_total: healthEmployer + healthEmployee,
            eps_code: affiliation?.eps_code || '',
            eps_name: affiliation?.eps_name || '',
            // Pensión
            pension_employer: pensionEmployer,
            pension_employee: pensionEmployee,
            pension_total: pensionEmployer + pensionEmployee,
            solidarity_fund: solidarityFund,
            afp_code: affiliation?.afp_code || '',
            afp_name: affiliation?.afp_name || '',
            // ARL
            arl_employer: arlEmployer,
            arl_risk_class: employee.arl_risk_class || 1,
            arl_code: affiliation?.arl_code || '',
            arl_name: affiliation?.arl_name || '',
            // CCF y Parafiscales
            ccf_employer: ccfEmployer,
            sena_employer: senaEmployer,
            icbf_employer: icbfEmployer,
            ccf_code: affiliation?.ccf_code || '',
            ccf_name: affiliation?.ccf_name || '',
            // Totales
            total_employer: totalEmployerForEmployee,
            total_employee: totalEmployeeDeductions,
            total: totalEmployerForEmployee + totalEmployeeDeductions
        });

        // Acumular por entidad - EPS
        const epsKey = affiliation?.eps_code || 'SIN_EPS';
        if (!byEntity.eps[epsKey]) {
            byEntity.eps[epsKey] = {
                code: epsKey, name: affiliation?.eps_name || 'Sin EPS',
                total_ibc: 0, total_employer: 0, total_employee: 0, count: 0
            };
        }
        byEntity.eps[epsKey].total_ibc += ibcHealth;
        byEntity.eps[epsKey].total_employer += healthEmployer;
        byEntity.eps[epsKey].total_employee += healthEmployee;
        byEntity.eps[epsKey].count++;

        // Acumular por entidad - AFP
        const afpKey = affiliation?.afp_code || 'SIN_AFP';
        if (!byEntity.afp[afpKey]) {
            byEntity.afp[afpKey] = {
                code: afpKey, name: affiliation?.afp_name || 'Sin AFP',
                total_ibc: 0, total_employer: 0, total_employee: 0, solidarity: 0, count: 0
            };
        }
        byEntity.afp[afpKey].total_ibc += ibcPension;
        byEntity.afp[afpKey].total_employer += pensionEmployer;
        byEntity.afp[afpKey].total_employee += pensionEmployee;
        byEntity.afp[afpKey].solidarity += solidarityFund;
        byEntity.afp[afpKey].count++;

        // Acumular por entidad - ARL
        const arlKey = affiliation?.arl_code || 'SIN_ARL';
        if (!byEntity.arl[arlKey]) {
            byEntity.arl[arlKey] = {
                code: arlKey, name: affiliation?.arl_name || 'Sin ARL',
                total_ibc: 0, total_employer: 0, count: 0
            };
        }
        byEntity.arl[arlKey].total_ibc += ibcArl;
        byEntity.arl[arlKey].total_employer += arlEmployer;
        byEntity.arl[arlKey].count++;

        // Acumular por entidad - CCF
        const ccfKey = affiliation?.ccf_code || 'SIN_CCF';
        if (!byEntity.ccf[ccfKey]) {
            byEntity.ccf[ccfKey] = {
                code: ccfKey, name: affiliation?.ccf_name || 'Sin CCF',
                total_ibc: 0, total_employer: 0, count: 0
            };
        }
        byEntity.ccf[ccfKey].total_ibc += ibcCcf;
        byEntity.ccf[ccfKey].total_employer += ccfEmployer;
        byEntity.ccf[ccfKey].count++;

        // Acumular totales generales
        totals.employee_count++;
        totals.ibc_health += ibcHealth;
        totals.health_employer += healthEmployer;
        totals.health_employee += healthEmployee;
        totals.health_total += healthEmployer + healthEmployee;
        totals.ibc_pension += ibcPension;
        totals.pension_employer += pensionEmployer;
        totals.pension_employee += pensionEmployee;
        totals.pension_total += pensionEmployer + pensionEmployee;
        totals.solidarity_fund += solidarityFund;
        totals.ibc_arl += ibcArl;
        totals.arl_employer += arlEmployer;
        totals.ibc_ccf += ibcCcf;
        totals.ccf_employer += ccfEmployer;
        totals.sena_employer += senaEmployer;
        totals.icbf_employer += icbfEmployer;
        totals.total_employer += totalEmployerForEmployee;
        totals.total_employee += totalEmployeeDeductions;
        totals.grand_total += totalEmployerForEmployee + totalEmployeeDeductions;
    }

    return {
        totals,
        by_entity: {
            eps: Object.values(byEntity.eps),
            afp: Object.values(byEntity.afp),
            arl: Object.values(byEntity.arl),
            ccf: Object.values(byEntity.ccf)
        },
        employee_details: employeeDetails,
        subsystems: getPilaSubsystems(),
        config_applied: {
            smlmv: config?.smlmv || 0,
            transport_allowance: config?.transportAllowance || 0
        }
    };
};

// =============================================
// GENERACIÓN DE ARCHIVO PLANO PILA
// =============================================

/**
 * Rellena un string a la derecha con caracteres hasta alcanzar el largo deseado.
 * @param {string} str - Cadena original
 * @param {number} length - Largo deseado
 * @param {string} char - Caracter de relleno (default: espacio)
 * @returns {string}
 */
const padRight = (str, length, char = ' ') => {
    return String(str || '').substring(0, length).padEnd(length, char);
};

/**
 * Rellena un string a la izquierda con caracteres hasta alcanzar el largo deseado.
 * @param {string} str - Cadena original
 * @param {number} length - Largo deseado
 * @param {string} char - Caracter de relleno (default: '0')
 * @returns {string}
 */
const padLeft = (str, length, char = '0') => {
    return String(str || '').substring(0, length).padStart(length, char);
};

/**
 * Formatea un valor monetario para el archivo plano (sin decimales, rellenado con ceros).
 * @param {number} value - Valor monetario
 * @param {number} length - Largo del campo (default: 9)
 * @returns {string}
 */
const formatMoney = (value, length = 9) => {
    return padLeft(Math.round(Number(value || 0)).toString(), length);
};

/**
 * Formatea una fecha para el archivo plano (YYYY-MM-DD).
 * @param {string|Date} date - Fecha a formatear
 * @returns {string} Fecha formateada o espacios si es nula
 */
const formatDate = (date) => {
    if (!date) return '          '; // 10 espacios
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

/**
 * Genera el archivo plano PILA en formato de operador tipo E (Aportes en Línea / SOI).
 *
 * El archivo contiene:
 * - Registro Tipo 1: Encabezado con datos del aportante
 * - Registros Tipo 2: Un registro por cada cotizante (empleado) con detalle de aportes
 *
 * Formato basado en la estructura estándar del operador de información
 * según Resolución 2388 de 2016 del Ministerio de Salud.
 *
 * @param {Object} pilaSummary - Resumen PILA calculado por calculatePilaSummary()
 * @param {Object} tenantInfo - Información de la empresa/tenant
 * @param {string} [tenantInfo.nit] - NIT de la empresa
 * @param {string} [tenantInfo.dv] - Dígito de verificación
 * @param {string} [tenantInfo.name] - Razón social
 * @param {string} [tenantInfo.address] - Dirección
 * @param {string} [tenantInfo.city] - Ciudad
 * @param {string} [tenantInfo.department] - Departamento
 * @param {string} [tenantInfo.phone] - Teléfono
 * @param {string} [tenantInfo.email] - Email
 * @returns {string} Contenido del archivo plano PILA
 */
const generatePilaFlatFile = (pilaSummary, tenantInfo) => {
    const lines = [];
    const now = new Date();
    const periodDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // ===========================================
    // REGISTRO TIPO 1 - ENCABEZADO DEL APORTANTE
    // ===========================================
    const header = [
        RECORD_TYPES.TIPO_1,                                    // 01 - Tipo de registro (2)
        '0001',                                                  // 02 - Secuencia (4)
        padRight(tenantInfo.nit || '', 16),                     // 03 - NIT del aportante (16)
        padLeft(tenantInfo.dv || '0', 1),                       // 04 - Dígito de verificación (1)
        'E',                                                     // 05 - Tipo de planilla (1): E=Empleador
        padLeft(pilaSummary.totals.employee_count.toString(), 5), // 06 - Número de cotizantes (5)
        padRight(periodDate, 7),                                // 07 - Período de pago (7)
        'S',                                                     // 08 - Tipo de aportante (1): S=Sociedad/Persona Jurídica
        padRight(tenantInfo.name || 'EMPRESA', 200),            // 09 - Razón social (200)
        'NI',                                                    // 10 - Tipo de documento del aportante (2)
        padRight('', 40),                                        // 11 - Nombre o razón social sucursal (40)
        padRight(tenantInfo.department || '', 2),                // 12 - Código departamento (2)
        padRight(tenantInfo.city || '', 3),                     // 13 - Código municipio (3)
        padRight(tenantInfo.address || '', 40),                 // 14 - Dirección (40)
        padRight(tenantInfo.phone || '', 10),                   // 15 - Teléfono (10)
        padRight('', 10),                                        // 16 - Fax (10)
        padRight(tenantInfo.email || '', 60),                   // 17 - Correo electrónico (60)
        padRight('', 2),                                         // 18 - Código ARL (2) - se llena si aplica
        padRight('', 6),                                         // 19 - Clase de riesgo ARL (6)
        formatDate(now),                                         // 20 - Fecha de pago (10)
    ].join('');

    lines.push(header);

    // ===========================================
    // REGISTROS TIPO 2 - DETALLE POR COTIZANTE
    // ===========================================
    let sequence = 1;

    for (const detail of pilaSummary.employee_details) {
        sequence++;
        const docType = TIPOS_DOCUMENTO_PILA[detail.document_type] || 'CC';

        const record = [
            RECORD_TYPES.TIPO_2,                                    // 01 - Tipo de registro (2)
            padLeft(sequence.toString(), 4),                        // 02 - Secuencia (4)
            padRight(docType, 2),                                   // 03 - Tipo de documento cotizante (2)
            padRight(detail.document_number, 16),                   // 04 - Número de documento (16)
            detail.tipo_cotizante,                                  // 05 - Tipo de cotizante (2)
            detail.subtipo_cotizante,                               // 06 - Subtipo de cotizante (2)
            ' ',                                                     // 07 - Extranjero no obligado a cotizar pensión (1)
            ' ',                                                     // 08 - Colombiano en el exterior (1)
            padRight(detail.department_code || '', 2),              // 09 - Código departamento ubicación laboral (2)
            padRight(detail.city_code || '', 3),                   // 10 - Código municipio ubicación laboral (3)
            padRight(detail.first_name, 20),                       // 11 - Primer nombre (20)
            padRight('', 30),                                       // 12 - Segundo nombre (30)
            padRight(detail.last_name, 20),                        // 13 - Primer apellido (20)
            padRight('', 30),                                       // 14 - Segundo apellido (30)
            ' ',                                                     // 15 - Indicador tarifa especial pensiones (1)
            padRight(detail.afp_code || '', 6),                    // 16 - Código de la AFP (6)
            padRight('', 6),                                        // 17 - AFP anterior (6)
            padRight(detail.eps_code || '', 6),                    // 18 - Código EPS (6)
            padRight('', 6),                                        // 19 - EPS anterior (6)
            padRight(detail.ccf_code || '', 6),                    // 20 - Código CCF (6)
            padLeft(detail.worked_days.toString(), 2),             // 21 - Días cotizados pensión (2)
            padLeft(detail.worked_days.toString(), 2),             // 22 - Días cotizados salud (2)
            padLeft(detail.worked_days.toString(), 2),             // 23 - Días cotizados ARL (2)
            padLeft(detail.worked_days.toString(), 2),             // 24 - Días cotizados CCF (2)
            formatMoney(detail.ibc_pension),                        // 25 - IBC Pensión (9)
            formatMoney(detail.ibc_health),                         // 26 - IBC Salud (9)
            formatMoney(detail.ibc_arl),                            // 27 - IBC ARL (9)
            formatMoney(detail.ibc_ccf),                            // 28 - IBC CCF (9)
            '04.000',                                                // 29 - Tarifa aportes pensión empleado (6)
            formatMoney(detail.pension_employer),                   // 30 - Cotización obligatoria pensión (9)
            '00.000',                                                // 31 - Aporte voluntario AFP (6)
            formatMoney(0),                                          // 32 - Aporte voluntario AFP (9)
            formatMoney(detail.solidarity_fund),                    // 33 - Fondo de solidaridad pensional (9)
            formatMoney(0),                                          // 34 - Fondo de subsistencia (9)
            formatMoney(0),                                          // 35 - Valor no retenido (9)
            '04.000',                                                // 36 - Tarifa aportes salud empleado (6)
            formatMoney(detail.health_employer + detail.health_employee), // 37 - Cotización salud (9)
            formatMoney(0),                                          // 38 - Valor UPC adicional (9)
            padRight('', 15),                                        // 39 - Número de autorización incapacidad (15)
            formatMoney(0),                                          // 40 - Valor incapacidad (9)
            padRight('', 15),                                        // 41 - Número de autorización licencia maternidad (15)
            formatMoney(0),                                          // 42 - Valor licencia maternidad (9)
            padLeft((detail.arl_risk_class || 1).toString(), 1),   // 43 - Clase de riesgo (1)
            padRight(detail.arl_code || '', 6),                    // 44 - Código ARL (6)
            formatMoney(detail.arl_employer),                       // 45 - Cotización ARL (9)
            formatMoney(detail.ccf_employer),                       // 46 - Cotización CCF (9)
            formatMoney(detail.sena_employer),                      // 47 - Cotización SENA (9)
            formatMoney(detail.icbf_employer),                      // 48 - Cotización ICBF (9)
            formatMoney(0),                                          // 49 - Cotización ESAP (9)
            formatMoney(0),                                          // 50 - Cotización MEN (9)
            padRight('', 2),                                         // 51 - Tipo de documento del cotizante principal (2)
            padRight('', 16),                                        // 52 - Número de documento del cotizante principal (16)
            ' ',                                                      // 53 - Indicador exonerado parafiscales Ley 1607 (1)
            padRight(detail.arl_code || '', 6),                    // 54 - Código ARL (para reporte) (6)
            padRight('', 1),                                         // 55 - Indicador clase de riesgo (1)
            formatDate(null),                                        // 56 - Fecha ingreso (10)
            formatDate(null),                                        // 57 - Fecha retiro (10)
            formatDate(null),                                        // 58 - Fecha inicio variación (10)
            formatDate(null),                                        // 59 - Fecha fin variación (10)
            padRight('', 1),                                         // 60 - Indicador variación permanente salario (1)
            padRight('', 1),                                         // 61 - Indicador corrección (1)
        ].join('');

        lines.push(record);
    }

    return lines.join('\r\n');
};

// =============================================
// EXPORTAR
// =============================================

module.exports = {
    calculatePilaSummary,
    generatePilaFlatFile,
    getPilaSubsystems,
    PILA_RATES,
    TIPOS_COTIZANTE,
    SUBTIPOS_COTIZANTE,
    TIPOS_DOCUMENTO_PILA,
    RECORD_TYPES
};
