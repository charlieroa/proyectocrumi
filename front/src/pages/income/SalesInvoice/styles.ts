// src/pages/income/SalesInvoice/styles.ts
import React from 'react';

export const createDocumentStyles = (color: string, isSaving: boolean): { [key: string]: React.CSSProperties } => ({
    // Layout principal
    container: {
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    wrapper: {
        maxWidth: '1100px',
        margin: '0 auto',
        marginTop: '4rem',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },

    // Tabs
    tabsContainer: {
        display: 'flex',
        borderBottom: '2px solid #e0e0e0',
        backgroundColor: '#fafafa',
        borderRadius: '8px 8px 0 0',
        overflow: 'hidden',
    },
    tab: {
        flex: 1,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: 'pointer',
        border: 'none',
        backgroundColor: 'transparent',
        fontSize: '14px',
        fontWeight: 500,
        color: '#666',
        transition: 'all 0.2s',
        borderBottom: '3px solid transparent',
    },
    tabActive: {
        backgroundColor: 'white',
        color: '#333',
        fontWeight: 600,
        borderBottom: '3px solid',
    },
    tabIcon: {
        fontSize: '18px',
    },

    // Header
    header: {
        padding: '24px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
    },
    companyInfo: {
        display: 'flex',
        flexDirection: 'column',
    },
    companyName: {
        fontSize: '24px',
        fontWeight: 700,
        color: '#333',
        margin: 0,
    },
    subtitle: {
        fontSize: '14px',
        color: '#666',
    },
    invoiceInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    invoiceLabel: {
        fontSize: '12px',
        color: '#999',
        textTransform: 'uppercase',
    },
    invoiceNumber: {
        fontSize: '24px',
        fontWeight: 700,
    },
    logoSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
    },
    logoBox: {
        width: '178px',
        height: '51px',
        border: '1px dashed #bdbdbd',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        backgroundColor: '#fafafa',
        fontSize: '12px',
        color: '#757575',
        position: 'relative',
        overflow: 'hidden',
    },
    logo: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain',
    },

    // Content
    content: {
        padding: '24px',
    },
    section: {
        marginBottom: '32px',
    },
    sectionTitle: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#333',
        marginBottom: '16px',
    },

    // Form elements
    input: {
        width: '100%',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        outline: 'none',
    },
    select: {
        width: '100%',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        outline: 'none',
        backgroundColor: 'white',
    },
    textarea: {
        width: '100%',
        minHeight: '80px',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        resize: 'vertical',
    },

    // Specific fields box (usado en los tabs)
    specificFieldsBox: {
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '6px',
        marginBottom: '24px',
        border: '1px solid #e9ecef',
    },
    specificFieldsTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#495057',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },

    // Table
    table: {
        width: '100%',
        borderCollapse: 'collapse',
    },
    tableHeader: {
        backgroundColor: '#f5f5f5',
        borderBottom: '2px solid #ddd',
    },
    tableHeaderCell: {
        padding: '12px',
        textAlign: 'left',
        fontSize: '13px',
        fontWeight: 600,
        color: '#555',
    },
    tableRow: {
        borderBottom: '1px solid #eee',
    },
    tableCell: {
        padding: '12px',
    },
    inputSmall: {
        padding: '8px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        outline: 'none',
        width: '100%',
    },

    // Buttons
    btnAddLine: {
        padding: '10px 16px',
        backgroundColor: '#f5f5f5',
        color: color,
        border: `1px dashed ${color}`,
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        width: '100%',
        marginTop: '16px',
    },
    btnNewContact: {
        padding: '10px 16px',
        backgroundColor: '#f5f5f5',
        color: color,
        border: `1px dashed ${color}`,
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        width: '100%',
        marginTop: '8px',
    },
    btnCancel: {
        padding: '10px 24px',
        backgroundColor: 'white',
        color: '#666',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
    },
    btnSave: {
        padding: '10px 24px',
        backgroundColor: isSaving ? '#ccc' : color,
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: isSaving ? 'not-allowed' : 'pointer',
    },

    // Totals
    totals: {
        marginTop: '24px',
        padding: '20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
    },
    totalsSection: {
        textAlign: 'right',
    },
    totalLabel: {
        fontSize: '14px',
        color: '#666',
    },
    totalAmount: {
        fontSize: '28px',
        fontWeight: 700,
        color: color,
    },

    // Notes
    notes: {
        marginTop: '24px',
    },
    terms: {
        fontSize: '12px',
        color: '#999',
        lineHeight: 1.5,
        marginTop: '16px',
    },

    // Actions
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '32px',
        paddingTop: '24px',
        borderTop: '1px solid #e0e0e0',
    },

    // Client
    clientResult: {
        padding: '12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        marginTop: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    clientInfo: {
        flex: 1,
    },
    clientName: {
        fontWeight: 600,
        color: '#333',
    },
    clientDoc: {
        fontSize: '13px',
        color: '#666',
    },

    // Modal
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1003,
    },
    modal: {
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '500px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflowY: 'auto',
    },
    modalHeader: {
        padding: '20px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: '18px',
        fontWeight: 600,
        margin: 0,
    },
    modalClose: {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#999',
    },
    modalBody: {
        padding: '20px',
    },
    modalFooter: {
        padding: '20px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
    },
    modalBtn: {
        padding: '10px 20px',
        border: 'none',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
    },
    modalBtnPrimary: {
        backgroundColor: color,
        color: 'white',
    },
    modalBtnSecondary: {
        backgroundColor: '#f5f5f5',
        color: '#333',
    },

    // Bulk upload
    bulkUploadSection: {
        marginBottom: '24px',
        padding: '20px',
        border: '2px dashed #1976d2',
        borderRadius: '8px',
        backgroundColor: '#e3f2fd',
        textAlign: 'center',
    },
    uploadIcon: {
        fontSize: '48px',
        color: '#1976d2',
        marginBottom: '12px',
    },
    bulkUploadLabel: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#1976d2',
        marginBottom: '8px',
    },
    bulkUploadSubLabel: {
        fontSize: '12px',
        color: '#666',
        marginBottom: '16px',
    },
    fileUploadBtn: {
        padding: '10px 20px',
        backgroundColor: '#1976d2',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
    },
    fileInput: {
        display: 'none',
    },
    fileInfo: {
        marginTop: '12px',
        fontSize: '13px',
        color: '#666',
    },
    autocompleteBtn: {
        padding: '8px 12px',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        cursor: 'pointer',
    },

    // Info boxes
    infoBox: {
        backgroundColor: '#e3f2fd',
        padding: '16px',
        borderRadius: '6px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid #90caf9',
    },
    infoIcon: {
        fontSize: '20px',
        color: '#1976d2',
    },
    infoText: {
        fontSize: '13px',
        color: '#1565c0',
        margin: 0,
    },

    // Return type (for nota credito)
    returnTypeBox: {
        padding: '16px',
        border: '2px solid #e0e0e0',
        borderRadius: '6px',
        marginTop: '16px',
    },
    returnTypeTitle: {
        fontSize: '14px',
        fontWeight: 600,
        marginBottom: '12px',
        color: '#333',
    },
    radioGroup: {
        display: 'flex',
        gap: '24px',
    },
    radioLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        fontSize: '14px',
    },

    // Payment invoices (for pago tab)
    paymentInvoicesList: {
        marginTop: '16px',
        border: '1px solid #e0e0e0',
        borderRadius: '6px',
        overflow: 'hidden',
    },
    invoiceItem: {
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
    },
    invoiceDetails: {
        flex: 1,
        fontSize: '13px',
    },
    paymentInvoiceNumber: {
        fontWeight: 600,
        color: '#333',
    },
    invoiceDate: {
        color: '#666',
        fontSize: '12px',
    },
    invoiceAmount: {
        fontWeight: 600,
        color: color,
    },
    paymentInput: {
        width: '120px',
        padding: '6px 10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '13px',
    },

    // Grid system
    row: {
        display: 'flex',
        flexWrap: 'wrap',
        marginRight: '-10px',
        marginLeft: '-10px',
    },
    col: {
        position: 'relative',
        width: '100%',
        paddingRight: '10px',
        paddingLeft: '10px',
    },
    formGroup: {
        marginBottom: '1rem',
    },
    label: {
        display: 'block',
        marginBottom: '0.5rem',
        fontWeight: 500,
        color: '#333',
        fontSize: '14px',
    },
});