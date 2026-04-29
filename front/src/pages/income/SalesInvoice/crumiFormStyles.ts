// Shared form styles for all document tabs (Factura, Cotización, Remisión, etc.)
// Detects dark mode from the root element and returns the appropriate palette.

function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark');
}

export function getCrumiFormStyles(loading?: boolean): Record<string, React.CSSProperties> {
  const dk = isDarkMode();

  // Palette
  const bg = dk ? '#111315' : '#f8f9fa';
  const surface = dk ? '#1A1D1F' : '#ffffff';
  const surfaceHover = dk ? '#272B30' : '#f3f4f6';
  const border = dk ? '#272B30' : '#e5e7eb';
  const borderLight = dk ? '#1f2225' : '#f3f4f6';
  const text = dk ? '#FCFCFC' : '#111827';
  const textMuted = dk ? '#9A9FA5' : '#6b7280';
  const textLabel = dk ? '#9A9FA5' : '#4b5563';
  const inputBg = dk ? '#111315' : '#ffffff';
  const accent = '#8B5CF6';
  const primary = dk ? accent : '#00bfa5';
  const danger = '#ef4444';

  return {
    wrapper: {
      fontFamily: '"Inter", "Segoe UI", sans-serif',
      backgroundColor: bg,
      minHeight: '100%',
      padding: '24px',
      paddingBottom: '80px',
    },

    // Barra superior
    topBar: {
      backgroundColor: surfaceHover,
      borderBottom: `1px solid ${border}`,
      padding: '16px 24px',
      display: 'flex',
      gap: '20px',
      alignItems: 'flex-end',
      borderRadius: '12px 12px 0 0',
    },
    topLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: textMuted,
      textTransform: 'uppercase' as const,
      marginBottom: '6px',
      display: 'block',
    },
    topSelect: {
      border: `1px solid ${border}`,
      borderRadius: '8px',
      padding: '8px 12px',
      fontSize: '13px',
      minWidth: '140px',
      backgroundColor: inputBg,
      color: text,
      outline: 'none',
    },
    topSelectActive: {
      backgroundColor: primary,
      color: '#ffffff',
      border: `1px solid ${primary}`,
      fontWeight: 600,
    },

    // Card principal
    card: {
      backgroundColor: surface,
      margin: '0',
      borderRadius: '12px',
      border: `1px solid ${border}`,
      boxShadow: 'none',
      overflow: 'hidden',
    },

    // Header logo + datos
    header: {
      padding: '24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottom: `1px solid ${border}`,
    },
    logoBox: {
      width: '160px',
      height: '100px',
      border: `2px dashed ${border}`,
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      backgroundColor: surfaceHover,
      color: textMuted,
      fontSize: '12px',
    },
    logoImage: {
      width: '100%',
      height: '100%',
      objectFit: 'contain' as const,
      borderRadius: '10px',
    },
    companyName: {
      fontSize: '24px',
      fontWeight: 700,
      color: text,
      marginTop: '16px',
    },
    invoiceNumber: {
      textAlign: 'right' as const,
    },
    invoiceLabel: {
      fontSize: '12px',
      color: textMuted,
      marginBottom: '4px',
    },
    invoiceNum: {
      fontSize: '32px',
      fontWeight: 700,
      color: text,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },

    // Body
    body: {
      padding: '20px 24px',
    },

    // Secciones
    sectionTitle: {
      fontSize: '15px',
      fontWeight: 700,
      color: text,
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    infoBox: {
      padding: '16px',
      borderRadius: '12px',
      backgroundColor: dk ? 'rgba(139,92,246,0.08)' : '#f0f9ff',
      border: `1px solid ${dk ? 'rgba(139,92,246,0.2)' : '#bae6fd'}`,
      fontSize: '13px',
      color: dk ? '#c4b5fd' : '#0369a1',
      marginBottom: '20px',
    },

    // Formulario — auto-fit: rellena el ancho con mínimo 180px por campo.
    // Evita espacios vacíos cuando hay pocos campos o la pantalla es ancha.
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '14px 16px',
      marginBottom: '20px',
      alignItems: 'end',
    },
    formField: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '6px',
      minWidth: 0,
    },
    label: {
      fontSize: '12px',
      color: textLabel,
      fontWeight: 500,
    },
    required: {
      color: danger,
    },
    input: {
      border: `1px solid ${border}`,
      borderRadius: '8px',
      padding: '9px 12px',
      fontSize: '13px',
      outline: 'none',
      transition: 'border 0.2s',
      backgroundColor: inputBg,
      color: text,
    },
    select: {
      border: `1px solid ${border}`,
      borderRadius: '8px',
      padding: '9px 12px',
      fontSize: '13px',
      backgroundColor: inputBg,
      color: text,
      outline: 'none',
      cursor: 'pointer',
    },
    newContactBtn: {
      color: primary,
      fontSize: '13px',
      fontWeight: 600,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px 0',
      marginTop: '4px',
      textAlign: 'left' as const,
    },

    // Tabla
    tableWrapper: {
      border: `1px solid ${border}`,
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '16px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    },
    th: {
      backgroundColor: surfaceHover,
      color: textMuted,
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      padding: '12px',
      textAlign: 'left' as const,
      borderBottom: `1px solid ${border}`,
    },
    td: {
      padding: '0',
      borderBottom: `1px solid ${borderLight}`,
    },
    inputCell: {
      width: '100%',
      border: 'none',
      padding: '12px',
      fontSize: '13px',
      outline: 'none',
      backgroundColor: 'transparent',
      color: text,
    },
    selectCell: {
      width: '100%',
      border: 'none',
      padding: '12px',
      fontSize: '13px',
      outline: 'none',
      backgroundColor: 'transparent',
      color: text,
      cursor: 'pointer',
    },
    deleteBtn: {
      background: 'none',
      border: 'none',
      color: danger,
      cursor: 'pointer',
      fontSize: '18px',
      padding: '8px',
    },
    addLineBtn: {
      color: primary,
      fontSize: '13px',
      fontWeight: 600,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },

    // Footer con totales
    footerGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 350px',
      gap: '40px',
      marginTop: '24px',
    },
    leftFooter: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '20px',
    },
    signatureBox: {
      border: `2px dashed ${border}`,
      borderRadius: '12px',
      padding: '40px 20px',
      textAlign: 'center' as const,
      color: textMuted,
      fontSize: '13px',
      cursor: 'pointer',
    },
    textareaLabel: {
      fontSize: '13px',
      fontWeight: 600,
      color: text,
      marginBottom: '8px',
    },
    textarea: {
      border: `1px solid ${border}`,
      borderRadius: '8px',
      padding: '10px 12px',
      fontSize: '13px',
      outline: 'none',
      minHeight: '80px',
      resize: 'vertical' as const,
      fontFamily: 'inherit',
      backgroundColor: inputBg,
      color: text,
    },
    totalsBox: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '14px',
      color: textMuted,
    },
    totalFinal: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '24px',
      fontWeight: 700,
      color: text,
      paddingTop: '16px',
      borderTop: `2px solid ${border}`,
      marginTop: '8px',
    },

    // Botones finales (sticky bottom)
    bottomBar: {
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: surface,
      borderTop: `1px solid ${border}`,
      padding: '12px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 100,
    },
    btnSecondary: {
      backgroundColor: surface,
      color: text,
      border: `1px solid ${border}`,
      padding: '10px 20px',
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '14px',
      cursor: 'pointer',
    },
    btnPrimary: {
      backgroundColor: primary,
      color: '#ffffff',
      border: 'none',
      padding: '10px 24px',
      borderRadius: '8px',
      fontWeight: 600,
      fontSize: '14px',
      cursor: 'pointer',
      opacity: loading ? 0.7 : 1,
    },

    // Modal
    modalOverlay: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    modal: {
      backgroundColor: surface,
      borderRadius: '16px',
      width: '500px',
      maxHeight: '90vh',
      overflow: 'auto',
      border: `1px solid ${border}`,
    },
    modalHeader: {
      padding: '20px 24px',
      borderBottom: `1px solid ${border}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: 600,
      color: text,
      margin: 0,
    },
    modalClose: {
      background: 'none',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: textMuted,
    },
    modalBody: {
      padding: '24px',
    },
    modalBtnWrapper: {
      display: 'flex',
      gap: '12px',
      marginTop: '24px',
    },

    // Extras for specific tabs
    radioGroup: {
      display: 'flex',
      gap: '12px',
      marginBottom: '16px',
    },
    radioOption: {
      flex: 1,
      padding: '16px',
      borderRadius: '12px',
      border: `1px solid ${border}`,
      backgroundColor: surface,
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    radioOptionActive: {
      flex: 1,
      padding: '16px',
      borderRadius: '12px',
      border: `2px solid ${primary}`,
      backgroundColor: dk ? 'rgba(139,92,246,0.08)' : '#f0fdf4',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
  };
}
