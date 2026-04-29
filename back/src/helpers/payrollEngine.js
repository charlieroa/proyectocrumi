// src/helpers/payrollEngine.js
//
// Motor de calculo de nomina colombiana para el sistema contable Crumi.
// Implementa las reglas de la legislacion laboral colombiana vigente:
//   - Codigo Sustantivo del Trabajo (CST)
//   - Ley 1607/2012, Ley 1819/2016, Ley 2277/2022
//   - Decreto 1072/2015 (compilatorio laboral)
//   - Art. 383 Estatuto Tributario (retencion en la fuente)

// ---------------------------------------------------------------------------
// CONSTANTES POR AÑO
// ---------------------------------------------------------------------------

const PAYROLL_CONSTANTS = {
  2024: {
    SMLMV: 1_300_000,
    TRANSPORT_ALLOWANCE: 162_000,
    UVT: 44_583,
  },
  2025: {
    SMLMV: 1_423_500,
    TRANSPORT_ALLOWANCE: 200_000,
    UVT: 47_065,
  },
  2026: {
    // Valores proyectados; actualizar cuando se publiquen los definitivos.
    SMLMV: 1_423_500,
    TRANSPORT_ALLOWANCE: 200_000,
    UVT: 47_065,
  },
};

/**
 * Tasas de ARL segun clase de riesgo (Decreto 1295/1994, Art. 26).
 *   I   - Riesgo minimo   : 0.522%
 *   II  - Riesgo bajo      : 1.044%
 *   III - Riesgo medio     : 2.436%
 *   IV  - Riesgo alto      : 4.350%
 *   V   - Riesgo maximo    : 6.960%
 */
const ARL_RATES = {
  1: 0.00522,
  2: 0.01044,
  3: 0.02436,
  4: 0.04350,
  5: 0.06960,
};

/**
 * Tabla de retencion en la fuente para empleados (Art. 383 ET).
 * Cada rango define: hasta cuantas UVT, porcentaje marginal, y UVT acumuladas
 * a restar para calcular el impuesto marginal.
 */
const WITHHOLDING_TABLE = [
  { from: 0,   to: 95,   rate: 0.00, base: 0   },
  { from: 95,  to: 150,  rate: 0.19, base: 95  },
  { from: 150, to: 360,  rate: 0.28, base: 150 },
  { from: 360, to: 640,  rate: 0.33, base: 360 },
  { from: 640, to: 945,  rate: 0.35, base: 640 },
  { from: 945, to: 2300, rate: 0.37, base: 945 },
  { from: 2300, to: Infinity, rate: 0.39, base: 2300 },
];

/**
 * Tabla del Fondo de Solidaridad Pensional (FSP).
 * Aplica para salarios superiores a 4 SMLMV (Art. 25 Ley 100/1993,
 * modificado por Art. 8 Ley 797/2003).
 */
const FSP_TABLE = [
  { from: 4,  to: 16, rate: 0.01  },
  { from: 16, to: 17, rate: 0.012 },
  { from: 17, to: 18, rate: 0.014 },
  { from: 18, to: 19, rate: 0.016 },
  { from: 19, to: 20, rate: 0.018 },
  { from: 20, to: Infinity, rate: 0.02 },
];

// ---------------------------------------------------------------------------
// FUNCIONES AUXILIARES
// ---------------------------------------------------------------------------

/**
 * Redondea al peso colombiano mas cercano (sin decimales).
 * @param {number} value - Valor a redondear.
 * @returns {number} Valor redondeado.
 */
function round(value) {
  return Math.round(value);
}

// ---------------------------------------------------------------------------
// getPayrollConfig
// ---------------------------------------------------------------------------

/**
 * Retorna las constantes de configuracion de nomina para un anio determinado.
 *
 * @param {number} year - Anio fiscal (ej: 2025).
 * @returns {{
 *   SMLMV: number,
 *   TRANSPORT_ALLOWANCE: number,
 *   UVT: number,
 *   ARL_RATES: Record<number, number>,
 *   FSP_TABLE: Array<{from:number, to:number, rate:number}>,
 *   WITHHOLDING_TABLE: Array<{from:number, to:number, rate:number, base:number}>
 * }}
 */
function getPayrollConfig(year) {
  const constants = PAYROLL_CONSTANTS[year] || PAYROLL_CONSTANTS[2025];
  return {
    ...constants,
    ARL_RATES: { ...ARL_RATES },
    FSP_TABLE: FSP_TABLE.map((r) => ({ ...r })),
    WITHHOLDING_TABLE: WITHHOLDING_TABLE.map((r) => ({ ...r })),
  };
}

// ---------------------------------------------------------------------------
// calculateOvertime
// ---------------------------------------------------------------------------

/**
 * Calcula las horas extra y recargos de un empleado en un periodo.
 *
 * Tipos reconocidos por la ley colombiana (CST Art. 168-172):
 *   HED  - Hora extra diurna              : factor 1.25
 *   HEN  - Hora extra nocturna             : factor 1.75
 *   HEDD - Hora extra dominical/festiva D  : factor 2.00
 *   HEDN - Hora extra dominical/festiva N  : factor 2.50
 *   RN   - Recargo nocturno                : factor 0.35
 *   RDD  - Recargo dominical diurno        : factor 0.75
 *   RDN  - Recargo dominical nocturno      : factor 1.10
 *
 * @param {number} hourlyRate - Valor hora ordinaria (baseSalary / 240).
 * @param {Object} novelties - Objeto con las horas por tipo de novedad.
 * @param {number} [novelties.HED=0]  - Horas extra diurnas.
 * @param {number} [novelties.HEN=0]  - Horas extra nocturnas.
 * @param {number} [novelties.HEDD=0] - Horas extra dominical/festiva diurna.
 * @param {number} [novelties.HEDN=0] - Horas extra dominical/festiva nocturna.
 * @param {number} [novelties.RN=0]   - Horas recargo nocturno.
 * @param {number} [novelties.RDD=0]  - Horas recargo dominical diurno.
 * @param {number} [novelties.RDN=0]  - Horas recargo dominical nocturno.
 * @returns {{
 *   HED:  { hours: number, factor: number, value: number },
 *   HEN:  { hours: number, factor: number, value: number },
 *   HEDD: { hours: number, factor: number, value: number },
 *   HEDN: { hours: number, factor: number, value: number },
 *   RN:   { hours: number, factor: number, value: number },
 *   RDD:  { hours: number, factor: number, value: number },
 *   RDN:  { hours: number, factor: number, value: number },
 *   total: number
 * }}
 */
function calculateOvertime(hourlyRate, novelties = {}) {
  const factors = {
    HED:  1.25,
    HEN:  1.75,
    HEDD: 2.00,
    HEDN: 2.50,
    RN:   0.35,
    RDD:  0.75,
    RDN:  1.10,
  };

  const result = {};
  let total = 0;

  for (const [type, factor] of Object.entries(factors)) {
    const hours = Number(novelties[type]) || 0;
    const value = round(hourlyRate * factor * hours);
    result[type] = { hours, factor, value };
    total += value;
  }

  result.total = total;
  return result;
}

// ---------------------------------------------------------------------------
// calculateIBC
// ---------------------------------------------------------------------------

/**
 * Calcula el Ingreso Base de Cotizacion (IBC) para seguridad social.
 *
 * Reglas:
 *   - IBC = devengado - auxilio de transporte (el auxilio no es factor salarial
 *     para seguridad social, excepto para prima y cesantias).
 *   - Minimo: 1 SMLMV.
 *   - Maximo: 25 SMLMV.
 *   - Para salario integral: IBC = 70% del total (Art. 132 CST, Art. 18 Ley 1122/2007).
 *
 * @param {number} devengado - Total devengado del empleado en el periodo.
 * @param {number} transportAllowance - Auxilio de transporte incluido en el devengado.
 * @param {Object} config - Configuracion de nomina (de getPayrollConfig).
 * @param {number} config.SMLMV - Salario minimo legal mensual vigente.
 * @param {boolean} [integralSalary=false] - Si el empleado tiene salario integral.
 * @returns {{ ibc: number, ibcMin: number, ibcMax: number }}
 */
function calculateIBC(devengado, transportAllowance, config, integralSalary = false) {
  const ibcMin = config.SMLMV;
  const ibcMax = config.SMLMV * 25;

  let ibc;

  if (integralSalary) {
    // Salario integral: el IBC es el 70% del total.
    ibc = round(devengado * 0.70);
  } else {
    // Regla general: descontar auxilio de transporte.
    ibc = devengado - transportAllowance;
  }

  // Aplicar limites.
  ibc = Math.max(ibc, ibcMin);
  ibc = Math.min(ibc, ibcMax);
  ibc = round(ibc);

  return { ibc, ibcMin, ibcMax };
}

// ---------------------------------------------------------------------------
// calculateDeductions
// ---------------------------------------------------------------------------

/**
 * Calcula las deducciones a cargo del empleado.
 *
 * Deducciones obligatorias:
 *   - Salud: 4% del IBC (Art. 204 Ley 100/1993).
 *   - Pension: 4% del IBC (Art. 20 Ley 100/1993).
 *   - Fondo de Solidaridad Pensional: segun tabla, si salario > 4 SMLMV
 *     (Art. 25 Ley 100/1993, modificado Ley 797/2003).
 *
 * @param {number} ibc - Ingreso Base de Cotizacion.
 * @param {number} salaryInSMLMV - Salario del empleado expresado en SMLMV.
 * @param {Object} config - Configuracion de nomina.
 * @param {Array<{from:number, to:number, rate:number}>} config.FSP_TABLE - Tabla FSP.
 * @returns {{
 *   salud: number,
 *   pension: number,
 *   fondoSolidaridad: number,
 *   fondoSolidaridadRate: number,
 *   totalDeductions: number
 * }}
 */
function calculateDeductions(ibc, salaryInSMLMV, config) {
  const salud = round(ibc * 0.04);
  const pension = round(ibc * 0.04);

  // Fondo de Solidaridad Pensional (solo aplica si salario > 4 SMLMV).
  let fondoSolidaridad = 0;
  let fondoSolidaridadRate = 0;

  if (salaryInSMLMV > 4) {
    const fspTable = config.FSP_TABLE || FSP_TABLE;
    for (const bracket of fspTable) {
      if (salaryInSMLMV > bracket.from && salaryInSMLMV <= bracket.to) {
        fondoSolidaridadRate = bracket.rate;
        break;
      }
    }
    // Caso limite: si supera 20 SMLMV y no se encontro bracket exacto.
    if (fondoSolidaridadRate === 0 && salaryInSMLMV > 20) {
      fondoSolidaridadRate = 0.02;
    }
    fondoSolidaridad = round(ibc * fondoSolidaridadRate);
  }

  const totalDeductions = salud + pension + fondoSolidaridad;

  return {
    salud,
    pension,
    fondoSolidaridad,
    fondoSolidaridadRate,
    totalDeductions,
  };
}

// ---------------------------------------------------------------------------
// calculateEmployerContributions
// ---------------------------------------------------------------------------

/**
 * Calcula los aportes patronales (a cargo del empleador).
 *
 * Aportes:
 *   - Salud empleador: 8.5% del IBC (Art. 204 Ley 100/1993).
 *   - Pension empleador: 12% del IBC (Art. 20 Ley 100/1993).
 *   - ARL: segun clase de riesgo (Decreto 1295/1994).
 *   - Caja de Compensacion: 4% del IBC.
 *   - SENA: 2% del IBC (exonerado Ley 1607/2012 si < 10 empleados y salario <= 10 SMLMV).
 *   - ICBF: 3% del IBC (misma exoneracion).
 *
 * @param {number} ibc - Ingreso Base de Cotizacion.
 * @param {number} arlRiskClass - Clase de riesgo ARL (1-5).
 * @param {Object} config - Configuracion de nomina.
 * @param {Record<number, number>} config.ARL_RATES - Tasas de ARL por clase de riesgo.
 * @param {number} config.SMLMV - Salario minimo.
 * @param {Object} [options={}] - Opciones adicionales.
 * @param {number} [options.employeeCount=10] - Numero de empleados de la empresa.
 * @param {number} [options.employeeSalary=0] - Salario base del empleado (para evaluar exoneracion).
 * @returns {{
 *   saludEmpleador: number,
 *   pensionEmpleador: number,
 *   arl: number,
 *   arlRate: number,
 *   cajaCompensacion: number,
 *   sena: number,
 *   icbf: number,
 *   senaExempt: boolean,
 *   icbfExempt: boolean,
 *   totalContributions: number
 * }}
 */
function calculateEmployerContributions(ibc, arlRiskClass, config, options = {}) {
  const { employeeCount = 10, employeeSalary = 0 } = options;
  const arlRates = config.ARL_RATES || ARL_RATES;

  const saludEmpleador = round(ibc * 0.085);
  const pensionEmpleador = round(ibc * 0.12);

  // ARL.
  const arlRate = arlRates[arlRiskClass] || arlRates[1];
  const arl = round(ibc * arlRate);

  // Caja de Compensacion Familiar - siempre aplica.
  const cajaCompensacion = round(ibc * 0.04);

  // Exoneracion SENA e ICBF (Ley 1607/2012, Art. 114-1 ET):
  // Aplica si la empresa tiene < 10 empleados Y el salario del empleado <= 10 SMLMV.
  const senaIcbfExempt = employeeCount < 10 && employeeSalary <= (config.SMLMV * 10);

  const sena = senaIcbfExempt ? 0 : round(ibc * 0.02);
  const icbf = senaIcbfExempt ? 0 : round(ibc * 0.03);

  const totalContributions = saludEmpleador + pensionEmpleador + arl
    + cajaCompensacion + sena + icbf;

  return {
    saludEmpleador,
    pensionEmpleador,
    arl,
    arlRate,
    cajaCompensacion,
    sena,
    icbf,
    senaExempt: senaIcbfExempt,
    icbfExempt: senaIcbfExempt,
    totalContributions,
  };
}

// ---------------------------------------------------------------------------
// calculateProvisions
// ---------------------------------------------------------------------------

/**
 * Calcula las provisiones de prestaciones sociales (causacion mensual).
 *
 * Prestaciones (CST):
 *   - Prima de servicios: (salario + auxTransporte) * diasTrabajados / 360
 *     (Art. 306 CST).
 *   - Cesantias: (salario + auxTransporte) * diasTrabajados / 360
 *     (Art. 249 CST).
 *   - Intereses sobre cesantias: cesantias * diasTrabajados * 12% / 360
 *     (Ley 52/1975, Art. 1).
 *   - Vacaciones: salarioBase * diasTrabajados / 720
 *     (Art. 186 CST - 15 dias habiles por anio).
 *
 * Nota: Para prima y cesantias, el auxilio de transporte ES factor salarial
 * (Art. 7 Ley 1 de 1963). Para vacaciones, NO se incluye auxilio de transporte.
 *
 * @param {number} salary - Salario base mensual.
 * @param {number} transportAllowance - Auxilio de transporte mensual (0 si no aplica).
 * @param {number} workedDays - Dias trabajados en el periodo (tipicamente 30 para mes completo).
 * @returns {{
 *   prima: number,
 *   cesantias: number,
 *   interesesCesantias: number,
 *   vacaciones: number,
 *   totalProvisions: number
 * }}
 */
function calculateProvisions(salary, transportAllowance, workedDays) {
  const baseWithTransport = salary + transportAllowance;

  // Prima de servicios.
  const prima = round((baseWithTransport * workedDays) / 360);

  // Cesantias.
  const cesantias = round((baseWithTransport * workedDays) / 360);

  // Intereses sobre cesantias (12% anual).
  const interesesCesantias = round((cesantias * workedDays * 0.12) / 360);

  // Vacaciones (sobre salario base, sin auxilio de transporte).
  const vacaciones = round((salary * workedDays) / 720);

  const totalProvisions = prima + cesantias + interesesCesantias + vacaciones;

  return {
    prima,
    cesantias,
    interesesCesantias,
    vacaciones,
    totalProvisions,
  };
}

// ---------------------------------------------------------------------------
// calculateWithholdingTax
// ---------------------------------------------------------------------------

/**
 * Calcula la retencion en la fuente para empleados (procedimiento 1, Art. 383 ET).
 *
 * Tabla progresiva simplificada (valores en UVT):
 *   0   - 95  UVT : 0%
 *   95  - 150 UVT : 19% sobre exceso de 95 UVT
 *   150 - 360 UVT : 28% sobre exceso de 150 UVT + impuesto acumulado
 *   360 - 640 UVT : 33% sobre exceso de 360 UVT + impuesto acumulado
 *   640 - 945 UVT : 35% sobre exceso de 640 UVT + impuesto acumulado
 *   945 - 2300 UVT: 37% sobre exceso de 945 UVT + impuesto acumulado
 *   2300+ UVT     : 39% sobre exceso de 2300 UVT + impuesto acumulado
 *
 * @param {number} monthlyIncome - Ingreso mensual gravable del empleado.
 * @param {Object} config - Configuracion de nomina.
 * @param {number} config.UVT - Valor de la UVT para el anio.
 * @param {Array} [config.WITHHOLDING_TABLE] - Tabla de retencion (opcional, usa default).
 * @returns {{
 *   incomeInUVT: number,
 *   withholdingInUVT: number,
 *   withholdingTax: number,
 *   effectiveRate: number
 * }}
 */
function calculateWithholdingTax(monthlyIncome, config) {
  const uvtValue = config.UVT;
  const table = config.WITHHOLDING_TABLE || WITHHOLDING_TABLE;

  const incomeInUVT = monthlyIncome / uvtValue;

  // Si esta por debajo del primer rango gravable, no hay retencion.
  if (incomeInUVT <= table[0].to) {
    return {
      incomeInUVT: Math.round(incomeInUVT * 100) / 100,
      withholdingInUVT: 0,
      withholdingTax: 0,
      effectiveRate: 0,
    };
  }

  // Calcular el impuesto acumulado rango por rango (suma de marginales).
  let withholdingInUVT = 0;
  for (let i = 1; i < table.length; i++) {
    const bracket = table[i];

    if (incomeInUVT <= bracket.from) {
      break;
    }

    const bracketBottom = bracket.from;
    const bracketTop = Math.min(incomeInUVT, bracket.to);
    const taxableInBracket = bracketTop - bracketBottom;

    if (taxableInBracket > 0) {
      withholdingInUVT += taxableInBracket * bracket.rate;
    }
  }

  const withholdingTax = round(withholdingInUVT * uvtValue);
  const effectiveRate = monthlyIncome > 0
    ? Math.round((withholdingTax / monthlyIncome) * 10000) / 10000
    : 0;

  return {
    incomeInUVT: Math.round(incomeInUVT * 100) / 100,
    withholdingInUVT: Math.round(withholdingInUVT * 100) / 100,
    withholdingTax,
    effectiveRate,
  };
}

// ---------------------------------------------------------------------------
// calculateLiquidation
// ---------------------------------------------------------------------------

/**
 * Calcula la liquidacion completa de nomina para un empleado en un periodo.
 *
 * Esta funcion orquesta todos los demas calculos y retorna un objeto completo
 * con devengados, deducciones, aportes patronales, provisiones y neto a pagar.
 *
 * @param {Object} employee - Datos del empleado.
 * @param {string} employee.id - ID del empleado.
 * @param {string} employee.name - Nombre completo.
 * @param {number} employee.baseSalary - Salario base mensual.
 * @param {boolean} [employee.integralSalary=false] - Si tiene salario integral.
 * @param {number} [employee.arlRiskClass=1] - Clase de riesgo ARL (1-5).
 *
 * @param {Object} period - Periodo de liquidacion.
 * @param {number} period.year - Anio del periodo.
 * @param {number} period.month - Mes del periodo (1-12).
 * @param {number} [period.workedDays=30] - Dias trabajados en el periodo.
 *
 * @param {Object} [novelties={}] - Novedades del periodo.
 * @param {number} [novelties.HED=0] - Horas extra diurnas.
 * @param {number} [novelties.HEN=0] - Horas extra nocturnas.
 * @param {number} [novelties.HEDD=0] - Horas extra dominical diurna.
 * @param {number} [novelties.HEDN=0] - Horas extra dominical nocturna.
 * @param {number} [novelties.RN=0] - Horas recargo nocturno.
 * @param {number} [novelties.RDD=0] - Horas recargo dominical diurno.
 * @param {number} [novelties.RDN=0] - Horas recargo dominical nocturno.
 * @param {number} [novelties.daysOff=0] - Dias de ausencia no remunerada.
 * @param {number} [novelties.sickLeaveDays=0] - Dias de incapacidad.
 * @param {number} [novelties.bonuses=0] - Bonificaciones adicionales.
 * @param {number} [novelties.commissions=0] - Comisiones.
 * @param {number} [novelties.otherIncome=0] - Otros ingresos salariales.
 * @param {number} [novelties.otherDeductions=0] - Otras deducciones (prestamos, embargos, etc).
 *
 * @param {Object} [config=null] - Configuracion de nomina. Si es null, se calcula automaticamente.
 * @param {number} [config.employeeCount=10] - Numero de empleados de la empresa.
 *
 * @returns {{
 *   employee: Object,
 *   period: Object,
 *   config: Object,
 *   earnings: Object,
 *   overtime: Object,
 *   deductions: Object,
 *   employerContributions: Object,
 *   provisions: Object,
 *   withholdingTax: Object,
 *   summary: {
 *     totalEarnings: number,
 *     totalDeductions: number,
 *     netPay: number,
 *     totalEmployerCost: number
 *   }
 * }}
 */
function calculateLiquidation(employee, period, novelties = {}, config = null) {
  // --- Configuracion ---
  const payrollConfig = config || getPayrollConfig(period.year);
  const { SMLMV, TRANSPORT_ALLOWANCE } = payrollConfig;

  // --- Datos del empleado ---
  const baseSalary = Number(employee.baseSalary ?? employee.base_salary ?? 0);
  const integralSalary = !!(employee.integralSalary ?? employee.integral_salary ?? false);
  const arlRiskClass = Number(employee.arlRiskClass ?? employee.arl_risk_class ?? 1) || 1;
  const workedDays = period.workedDays != null ? period.workedDays : 30;
  const employeeCount = (config && config.employeeCount) || 10;
  const employeeName = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || `Empleado ${employee.id}`;

  // --- Dias de ausencia y ajuste proporcional ---
  const daysOff = Number(novelties.daysOff) || 0;
  const sickLeaveDays = Number(novelties.sickLeaveDays) || 0;
  const effectiveWorkedDays = Math.max(0, workedDays - daysOff);

  // --- Salario proporcional ---
  const proportionalSalary = round((baseSalary / 30) * effectiveWorkedDays);

  // --- Auxilio de transporte ---
  // Aplica si salario base <= 2 SMLMV y no es salario integral.
  const qualifiesForTransport = !integralSalary && baseSalary <= (SMLMV * 2);
  const transportAllowance = qualifiesForTransport
    ? round((TRANSPORT_ALLOWANCE / 30) * effectiveWorkedDays)
    : 0;

  // --- Incapacidad (los primeros 2 dias los paga el empleador al 100%, del 3 en adelante EPS al 66.67%) ---
  let sickLeavePayment = 0;
  if (sickLeaveDays > 0) {
    const dailyRate = baseSalary / 30;
    const employerSickDays = Math.min(sickLeaveDays, 2);
    const epsSickDays = Math.max(0, sickLeaveDays - 2);
    // El empleador paga los primeros 2 dias al 100%.
    sickLeavePayment = round(dailyRate * employerSickDays);
    // Los dias EPS se pagan al 66.67% (esto normalmente lo paga la EPS,
    // pero se incluye como referencia del devengado del empleado).
    sickLeavePayment += round(dailyRate * 0.6667 * epsSickDays);
  }

  // --- Tasa hora ordinaria ---
  const hourlyRate = baseSalary / 240;

  // --- Horas extra y recargos ---
  const overtime = calculateOvertime(hourlyRate, novelties);

  // --- Bonificaciones, comisiones y otros ingresos ---
  const bonuses = round(Number(novelties.bonuses) || 0);
  const commissions = round(Number(novelties.commissions) || 0);
  const otherIncome = round(Number(novelties.otherIncome) || 0);

  // --- Total devengado ---
  const totalEarnings = proportionalSalary
    + transportAllowance
    + overtime.total
    + sickLeavePayment
    + bonuses
    + commissions
    + otherIncome;

  // --- IBC ---
  const { ibc } = calculateIBC(
    totalEarnings,
    transportAllowance,
    payrollConfig,
    integralSalary,
  );

  // --- Salario expresado en SMLMV (para tabla FSP) ---
  const salaryInSMLMV = baseSalary / SMLMV;

  // --- Deducciones del empleado ---
  const deductions = calculateDeductions(ibc, salaryInSMLMV, payrollConfig);

  // --- Retencion en la fuente ---
  // La base gravable simplificada: total devengado menos aportes obligatorios del empleado.
  const taxableIncome = totalEarnings - deductions.salud - deductions.pension;
  const withholding = calculateWithholdingTax(
    Math.max(0, taxableIncome),
    payrollConfig,
  );

  // --- Otras deducciones (prestamos, embargos, libranzas, etc.) ---
  const otherDeductions = round(Number(novelties.otherDeductions) || 0);

  // --- Total deducciones ---
  const totalDeductions = deductions.totalDeductions
    + withholding.withholdingTax
    + otherDeductions;

  // --- Neto a pagar ---
  const netPay = round(totalEarnings - totalDeductions);

  // --- Aportes patronales ---
  const employerContributions = calculateEmployerContributions(
    ibc,
    arlRiskClass,
    payrollConfig,
    {
      employeeCount,
      employeeSalary: baseSalary,
    },
  );

  // --- Provisiones de prestaciones sociales ---
  const provisions = calculateProvisions(
    proportionalSalary,
    transportAllowance,
    effectiveWorkedDays,
  );

  // --- Costo total empleador ---
  const totalEmployerCost = totalEarnings
    + employerContributions.totalContributions
    + provisions.totalProvisions;

  // --- Objeto de resultado ---
  return {
    employee: {
      id: employee.id,
      name: employeeName,
      baseSalary,
      integralSalary,
      arlRiskClass,
    },
    period: {
      year: period.year,
      month: period.month,
      workedDays,
      effectiveWorkedDays,
      daysOff,
      sickLeaveDays,
    },
    config: {
      SMLMV,
      TRANSPORT_ALLOWANCE,
      UVT: payrollConfig.UVT,
    },
    earnings: {
      proportionalSalary,
      transportAllowance,
      qualifiesForTransport,
      overtimeTotal: overtime.total,
      sickLeavePayment,
      bonuses,
      commissions,
      otherIncome,
      totalEarnings,
    },
    overtime,
    ibc: {
      value: ibc,
      salaryInSMLMV: Math.round(salaryInSMLMV * 100) / 100,
    },
    deductions: {
      ...deductions,
      withholdingTax: withholding.withholdingTax,
      otherDeductions,
      totalDeductions,
    },
    withholdingTax: withholding,
    employerContributions,
    provisions,
    summary: {
      totalEarnings,
      totalDeductions,
      netPay,
      totalEmployerCost,
    },
  };
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  calculateLiquidation,
  calculateOvertime,
  calculateDeductions,
  calculateEmployerContributions,
  calculateProvisions,
  calculateIBC,
  calculateWithholdingTax,
  getPayrollConfig,
};
