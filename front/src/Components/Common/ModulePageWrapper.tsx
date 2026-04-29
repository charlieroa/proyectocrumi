import React from 'react';

interface ModulePageWrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps legacy Bootstrap pages so they render correctly inside the new CrumiLayout.
 * Comprehensive CSS overrides to match the modern Crumi dashboard aesthetic.
 */
const ModulePageWrapper: React.FC<ModulePageWrapperProps> = ({ children }) => {
  return (
    <div className="crumi-module-wrapper">
      <style>{`
        /* ===================================================
           CRUMI MODULE WRAPPER - Modern Dashboard Overrides
           =================================================== */

        /* === Base Reset === */
        .crumi-module-wrapper {
          padding: 0;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .crumi-module-wrapper .page-content {
          padding: 0 !important;
          margin: 0 !important;
          min-height: auto !important;
        }
        .crumi-module-wrapper .container-fluid {
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        /* === Page Headers === */
        .crumi-module-wrapper h4,
        .crumi-module-wrapper h5 {
          font-weight: 700 !important;
          letter-spacing: -0.02em !important;
        }
        .crumi-module-wrapper .page-title-box {
          padding: 0 !important;
          margin-bottom: 1.5rem !important;
        }
        .crumi-module-wrapper .breadcrumb {
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          font-size: 13px !important;
        }

        /* === Cards === */
        .crumi-module-wrapper .card {
          border-radius: 24px !important;
          border: none !important;
          box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.04), 0px 0px 1px rgba(0, 0, 0, 0.06) !important;
          overflow: hidden !important;
          margin-bottom: 1.25rem !important;
          transition: box-shadow 0.2s ease !important;
        }
        .crumi-module-wrapper .card:hover {
          box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.06), 0px 0px 1px rgba(0, 0, 0, 0.08) !important;
        }
        .crumi-module-wrapper .card-header {
          border-radius: 24px 24px 0 0 !important;
          border-bottom: 1px solid #EFEFEF !important;
          background: transparent !important;
          padding: 1.25rem 1.5rem !important;
        }
        .crumi-module-wrapper .card-body {
          padding: 1.5rem !important;
        }
        .crumi-module-wrapper .card-footer {
          border-top: 1px solid #EFEFEF !important;
          background: transparent !important;
          padding: 1rem 1.5rem !important;
        }
        .crumi-module-wrapper .card-title {
          font-weight: 700 !important;
          font-size: 15px !important;
          color: #1A1D1F !important;
        }
        .crumi-module-wrapper .card-animate {
          transition: all 0.3s ease !important;
        }
        .crumi-module-wrapper .card-animate:hover {
          transform: translateY(-2px) !important;
        }

        /* === Tabs (pill style) === */
        .crumi-module-wrapper .nav-tabs,
        .crumi-module-wrapper .nav-tabs-custom {
          border-bottom: none !important;
          gap: 4px !important;
          background: #F3F5F7 !important;
          border-radius: 9999px !important;
          padding: 4px !important;
          display: inline-flex !important;
          flex-wrap: nowrap !important;
          overflow-x: auto !important;
        }
        .crumi-module-wrapper .nav-tabs .nav-item {
          margin-bottom: 0 !important;
        }
        .crumi-module-wrapper .nav-tabs .nav-link {
          border: none !important;
          border-radius: 9999px !important;
          padding: 8px 18px !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #6F767E !important;
          transition: all 0.2s ease !important;
          white-space: nowrap !important;
          background: transparent !important;
        }
        .crumi-module-wrapper .nav-tabs .nav-link:hover {
          color: #1A1D1F !important;
          background: rgba(0,0,0,0.04) !important;
        }
        .crumi-module-wrapper .nav-tabs .nav-link.active {
          background: #1A1D1F !important;
          color: #FFFFFF !important;
          box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.08) !important;
        }
        .crumi-module-wrapper .nav-tabs .nav-link::after,
        .crumi-module-wrapper .nav-tabs .nav-link::before {
          display: none !important;
        }

        /* === Tables === */
        .crumi-module-wrapper .table {
          margin-bottom: 0 !important;
        }
        .crumi-module-wrapper .table thead th {
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
          color: #6F767E !important;
          border-bottom: 1px solid #EFEFEF !important;
          border-top: none !important;
          padding: 14px 16px !important;
          background: transparent !important;
        }
        .crumi-module-wrapper .table tbody td {
          padding: 14px 16px !important;
          border-bottom: 1px solid #EFEFEF !important;
          border-top: none !important;
          font-size: 14px !important;
          vertical-align: middle !important;
          color: #1A1D1F !important;
        }
        .crumi-module-wrapper .table tbody tr:last-child td {
          border-bottom: none !important;
        }
        .crumi-module-wrapper .table-hover tbody tr:hover {
          background-color: #F3F5F7 !important;
        }
        .crumi-module-wrapper .table-light {
          background-color: #F3F5F7 !important;
        }
        .crumi-module-wrapper .table-responsive {
          border-radius: 12px !important;
        }

        /* === Buttons === */
        .crumi-module-wrapper .btn-primary,
        .crumi-module-wrapper .btn-primary:focus {
          background: #1A1D1F !important;
          border-color: #1A1D1F !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          padding: 8px 20px !important;
          font-size: 14px !important;
          transition: all 0.2s ease !important;
          box-shadow: none !important;
        }
        .crumi-module-wrapper .btn-primary:hover {
          background: #111315 !important;
          border-color: #111315 !important;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.12) !important;
          transform: translateY(-1px) !important;
        }
        .crumi-module-wrapper .btn-success,
        .crumi-module-wrapper .btn-success:focus {
          background: #83BF6E !important;
          border-color: #83BF6E !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }
        .crumi-module-wrapper .btn-danger,
        .crumi-module-wrapper .btn-danger:focus {
          border-radius: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }
        .crumi-module-wrapper .btn-warning,
        .crumi-module-wrapper .btn-warning:focus {
          border-radius: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }
        .crumi-module-wrapper .btn-info,
        .crumi-module-wrapper .btn-info:focus {
          border-radius: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
        }
        .crumi-module-wrapper .btn-light,
        .crumi-module-wrapper .btn-secondary {
          border-radius: 12px !important;
          font-weight: 500 !important;
          border-color: #EFEFEF !important;
        }
        .crumi-module-wrapper .btn-outline-primary {
          border-color: #EFEFEF !important;
          color: #1A1D1F !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
        }
        .crumi-module-wrapper .btn-outline-primary:hover {
          background: #F3F5F7 !important;
          border-color: #EFEFEF !important;
          color: #1A1D1F !important;
        }
        .crumi-module-wrapper .btn-soft-primary {
          background: #F3F5F7 !important;
          color: #1A1D1F !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          border: none !important;
        }
        .crumi-module-wrapper .btn-soft-primary:hover {
          background: #E8EAED !important;
        }
        .crumi-module-wrapper .btn-sm {
          padding: 6px 14px !important;
          font-size: 13px !important;
          border-radius: 10px !important;
        }
        .crumi-module-wrapper .btn-group .btn {
          border-radius: 0 !important;
        }
        .crumi-module-wrapper .btn-group .btn:first-child {
          border-radius: 12px 0 0 12px !important;
        }
        .crumi-module-wrapper .btn-group .btn:last-child {
          border-radius: 0 12px 12px 0 !important;
        }

        /* === Inputs === */
        .crumi-module-wrapper .form-control,
        .crumi-module-wrapper .form-select {
          border-radius: 12px !important;
          border-color: #EFEFEF !important;
          font-size: 14px !important;
          padding: 10px 14px !important;
          transition: all 0.2s ease !important;
          color: #1A1D1F !important;
        }
        .crumi-module-wrapper .form-control:focus,
        .crumi-module-wrapper .form-select:focus {
          border-color: #8B5CF6 !important;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12) !important;
        }
        .crumi-module-wrapper .form-control[type="date"] {
          padding: 6px 12px !important;
        }
        .crumi-module-wrapper .form-label,
        .crumi-module-wrapper label.fw-medium {
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #6F767E !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
          margin-bottom: 6px !important;
        }
        .crumi-module-wrapper .input-group {
          border-radius: 12px !important;
          overflow: hidden !important;
        }
        .crumi-module-wrapper .input-group .form-control {
          border-radius: 12px 0 0 12px !important;
        }
        .crumi-module-wrapper .input-group .btn {
          border-radius: 0 12px 12px 0 !important;
        }
        .crumi-module-wrapper .input-group-text {
          border-color: #EFEFEF !important;
          background: #F3F5F7 !important;
        }

        /* === Badges === */
        .crumi-module-wrapper .badge {
          border-radius: 9999px !important;
          font-weight: 600 !important;
          font-size: 11px !important;
          padding: 5px 12px !important;
          letter-spacing: 0.02em !important;
        }

        /* === Alerts === */
        .crumi-module-wrapper .alert {
          border-radius: 16px !important;
          border: none !important;
          font-size: 14px !important;
        }

        /* === Pagination === */
        .crumi-module-wrapper .pagination {
          gap: 4px !important;
        }
        .crumi-module-wrapper .page-link {
          border-radius: 10px !important;
          border: none !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          color: #6F767E !important;
          padding: 6px 12px !important;
          transition: all 0.2s ease !important;
        }
        .crumi-module-wrapper .page-link:hover {
          background: #F3F5F7 !important;
          color: #1A1D1F !important;
        }
        .crumi-module-wrapper .page-item.active .page-link {
          background: #1A1D1F !important;
          color: #FFFFFF !important;
        }
        .crumi-module-wrapper .page-item.disabled .page-link {
          opacity: 0.4 !important;
        }

        /* === Modal === */
        .crumi-module-wrapper .modal-content {
          border-radius: 24px !important;
          border: none !important;
          box-shadow: 0px 24px 64px rgba(0, 0, 0, 0.12) !important;
          overflow: hidden !important;
        }
        .crumi-module-wrapper .modal-header {
          border-bottom: 1px solid #EFEFEF !important;
          padding: 1.25rem 1.5rem !important;
        }
        .crumi-module-wrapper .modal-header .modal-title {
          font-weight: 700 !important;
          font-size: 16px !important;
        }
        .crumi-module-wrapper .modal-body {
          padding: 1.5rem !important;
        }
        .crumi-module-wrapper .modal-footer {
          border-top: 1px solid #EFEFEF !important;
          padding: 1rem 1.5rem !important;
        }

        /* === Spinners === */
        .crumi-module-wrapper .spinner-border {
          color: #8B5CF6 !important;
        }

        /* === Progress === */
        .crumi-module-wrapper .progress {
          border-radius: 9999px !important;
          height: 8px !important;
          background: #F3F5F7 !important;
        }
        .crumi-module-wrapper .progress-bar {
          border-radius: 9999px !important;
        }

        /* === Avatar containers === */
        .crumi-module-wrapper .avatar-sm {
          width: 40px !important;
          height: 40px !important;
        }
        .crumi-module-wrapper .avatar-title {
          border-radius: 14px !important;
        }
        .crumi-module-wrapper .rounded-circle.avatar-title,
        .crumi-module-wrapper .avatar-sm .avatar-title {
          border-radius: 14px !important;
        }

        /* === Widget cards (KPI style) === */
        .crumi-module-wrapper .card-animate .card-body {
          padding: 1.5rem !important;
        }
        .crumi-module-wrapper .card-animate .fs-22 {
          font-size: 28px !important;
          font-weight: 800 !important;
          letter-spacing: -0.02em !important;
        }
        .crumi-module-wrapper .card-animate .text-uppercase.text-muted {
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.06em !important;
          color: #6F767E !important;
        }

        /* === Dropdown === */
        .crumi-module-wrapper .dropdown-menu {
          border-radius: 16px !important;
          border: 1px solid #EFEFEF !important;
          box-shadow: 0px 12px 32px rgba(0, 0, 0, 0.08) !important;
          padding: 6px !important;
        }
        .crumi-module-wrapper .dropdown-item {
          border-radius: 10px !important;
          padding: 8px 14px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          transition: all 0.15s ease !important;
        }
        .crumi-module-wrapper .dropdown-item:hover,
        .crumi-module-wrapper .dropdown-item:focus {
          background: #F3F5F7 !important;
          color: #1A1D1F !important;
        }

        /* === Muted text === */
        .crumi-module-wrapper .text-muted {
          color: #6F767E !important;
        }

        /* === Row spacing === */
        .crumi-module-wrapper .row {
          --bs-gutter-x: 1.25rem !important;
        }

        /* === Background subtle colors === */
        .crumi-module-wrapper .bg-light {
          background-color: #F3F5F7 !important;
        }

        /* === Accordion / FAQ === */
        .crumi-module-wrapper .accordion-item {
          border-radius: 16px !important;
          border: none !important;
          box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.04) !important;
          margin-bottom: 8px !important;
          overflow: hidden !important;
        }
        .crumi-module-wrapper .accordion-button {
          font-weight: 600 !important;
          border-radius: 16px !important;
        }

        /* === Flatpickr inputs === */
        .crumi-module-wrapper .flatpickr-input {
          border-radius: 12px !important;
          border-color: #EFEFEF !important;
          padding: 8px 14px !important;
          font-size: 14px !important;
        }

        /* === React-Select === */
        .crumi-module-wrapper [class*="control"] {
          border-radius: 12px !important;
        }

        /* === Kanban specific === */
        .crumi-module-wrapper .tasks-board {
          border-radius: 20px !important;
        }

        /* ===================================================
           DARK MODE OVERRIDES
           =================================================== */
        .dark .crumi-module-wrapper .card {
          background: #1A1D1F !important;
          box-shadow: none !important;
        }
        .dark .crumi-module-wrapper .card:hover {
          box-shadow: 0 0 0 1px rgba(255,255,255,0.06) !important;
        }
        .dark .crumi-module-wrapper .card-header {
          border-bottom-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .card-footer {
          border-top-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .card-title {
          color: #FCFCFC !important;
        }

        /* Dark tabs */
        .dark .crumi-module-wrapper .nav-tabs,
        .dark .crumi-module-wrapper .nav-tabs-custom {
          background: #111315 !important;
        }
        .dark .crumi-module-wrapper .nav-tabs .nav-link {
          color: #9A9FA5 !important;
        }
        .dark .crumi-module-wrapper .nav-tabs .nav-link:hover {
          color: #FCFCFC !important;
          background: rgba(255,255,255,0.06) !important;
        }
        .dark .crumi-module-wrapper .nav-tabs .nav-link.active {
          background: #FCFCFC !important;
          color: #1A1D1F !important;
        }

        /* Dark tables */
        .dark .crumi-module-wrapper .table thead th {
          color: #9A9FA5 !important;
          border-bottom-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .table tbody td {
          color: #FCFCFC !important;
          border-bottom-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .table-hover tbody tr:hover {
          background-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .table-light {
          background-color: #272B30 !important;
        }

        /* Dark buttons */
        .dark .crumi-module-wrapper .btn-primary,
        .dark .crumi-module-wrapper .btn-primary:focus {
          background: #8B5CF6 !important;
          border-color: #8B5CF6 !important;
        }
        .dark .crumi-module-wrapper .btn-primary:hover {
          background: #7C3AED !important;
          border-color: #7C3AED !important;
        }
        .dark .crumi-module-wrapper .btn-outline-primary {
          border-color: #272B30 !important;
          color: #FCFCFC !important;
        }
        .dark .crumi-module-wrapper .btn-outline-primary:hover {
          background: #272B30 !important;
          border-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .btn-soft-primary {
          background: #272B30 !important;
          color: #FCFCFC !important;
        }
        .dark .crumi-module-wrapper .btn-light,
        .dark .crumi-module-wrapper .btn-secondary {
          background: #272B30 !important;
          border-color: #272B30 !important;
          color: #FCFCFC !important;
        }

        /* Dark inputs */
        .dark .crumi-module-wrapper .form-control,
        .dark .crumi-module-wrapper .form-select {
          background: #111315 !important;
          border-color: #272B30 !important;
          color: #FCFCFC !important;
        }
        .dark .crumi-module-wrapper .form-label,
        .dark .crumi-module-wrapper label.fw-medium {
          color: #9A9FA5 !important;
        }
        .dark .crumi-module-wrapper .input-group-text {
          background: #272B30 !important;
          border-color: #272B30 !important;
          color: #9A9FA5 !important;
        }

        /* Dark pagination */
        .dark .crumi-module-wrapper .page-link {
          color: #9A9FA5 !important;
          background: transparent !important;
        }
        .dark .crumi-module-wrapper .page-link:hover {
          background: #272B30 !important;
          color: #FCFCFC !important;
        }
        .dark .crumi-module-wrapper .page-item.active .page-link {
          background: #8B5CF6 !important;
          color: #FFFFFF !important;
        }

        /* Dark modals */
        .dark .crumi-module-wrapper .modal-content {
          background: #1A1D1F !important;
        }
        .dark .crumi-module-wrapper .modal-header {
          border-bottom-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .modal-footer {
          border-top-color: #272B30 !important;
        }

        /* Dark text */
        .dark .crumi-module-wrapper .text-muted {
          color: #9A9FA5 !important;
        }
        .dark .crumi-module-wrapper h4,
        .dark .crumi-module-wrapper h5,
        .dark .crumi-module-wrapper h6 {
          color: #FCFCFC !important;
        }

        /* Dark bg-light */
        .dark .crumi-module-wrapper .bg-light {
          background-color: #111315 !important;
        }

        /* Dark spinner */
        .dark .crumi-module-wrapper .spinner-border {
          color: #8B5CF6 !important;
        }

        /* Dark avatar */
        .dark .crumi-module-wrapper .avatar-title {
          opacity: 0.9 !important;
        }

        /* Dark dropdown */
        .dark .crumi-module-wrapper .dropdown-menu {
          background: #1A1D1F !important;
          border-color: #272B30 !important;
        }
        .dark .crumi-module-wrapper .dropdown-item {
          color: #FCFCFC !important;
        }
        .dark .crumi-module-wrapper .dropdown-item:hover,
        .dark .crumi-module-wrapper .dropdown-item:focus {
          background: #272B30 !important;
        }

        /* Dark accordion */
        .dark .crumi-module-wrapper .accordion-item {
          background: #1A1D1F !important;
        }
        .dark .crumi-module-wrapper .accordion-button {
          background: #1A1D1F !important;
          color: #FCFCFC !important;
        }

        /* Dark progress */
        .dark .crumi-module-wrapper .progress {
          background: #272B30 !important;
        }

        /* Dark flatpickr */
        .dark .crumi-module-wrapper .flatpickr-input {
          background: #111315 !important;
          border-color: #272B30 !important;
          color: #FCFCFC !important;
        }

        /* Dark alert */
        .dark .crumi-module-wrapper .alert {
          border: none !important;
        }
      `}</style>
      {children}
    </div>
  );
};

export default ModulePageWrapper;
