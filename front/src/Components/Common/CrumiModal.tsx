import React from 'react';
import { createPortal } from 'react-dom';

interface CrumiModalProps {
    isOpen: boolean;
    toggle: () => void;
    title: string;
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    onSubmit?: () => void;
    submitText?: string;
    cancelText?: string;
    isSubmitting?: boolean;
    submitDisabled?: boolean;
    footer?: React.ReactNode;
}

const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
};

const CrumiModal: React.FC<CrumiModalProps> = ({
    isOpen,
    toggle,
    title,
    subtitle,
    size = 'md',
    children,
    onSubmit,
    submitText = 'Guardar',
    cancelText = 'Cancelar',
    isSubmitting = false,
    submitDisabled = false,
    footer,
}) => {
    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) toggle();
    };

    const renderFooter = () => {
        if (footer) return footer;
        if (!onSubmit) return null;
        return (
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-700/40">
                <button
                    type="button"
                    onClick={toggle}
                    className="px-4 py-2 rounded-lg text-xs font-semibold
                        text-crumi-text-muted dark:text-crumi-text-dark-muted
                        hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    {cancelText}
                </button>
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting || submitDisabled}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold
                        bg-crumi-accent text-white
                        hover:bg-crumi-accent/90 hover:shadow-md hover:shadow-crumi-accent/20
                        transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                >
                    {isSubmitting && (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    {submitText}
                </button>
            </div>
        );
    };

    return createPortal(
        <div
            className="fixed inset-0 flex items-center justify-center"
            style={{ zIndex: 2050 }}
        >
            {/* Backdrop – no cierra al hacer click para evitar cierres accidentales en móvil */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* Modal */}
            <div
                onMouseDown={e => e.stopPropagation()}
                className={`relative w-full ${sizeClasses[size]} mx-4 bg-white dark:bg-crumi-surface-dark rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/30 overflow-hidden`}
            >
                {/* Accent line */}
                <div className="h-0.5 bg-gradient-to-r from-crumi-accent via-crumi-accent/60 to-transparent" />

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-4 pb-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[13px] font-semibold text-crumi-text-primary dark:text-white">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-[11px] text-crumi-text-muted dark:text-crumi-text-dark-muted leading-none !mb-0">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={toggle}
                        className="ml-3 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors -mt-0.5"
                    >
                        <i className="ri-close-line text-[16px] text-crumi-text-muted dark:text-crumi-text-dark-muted"></i>
                    </button>
                </div>

                <div className="mx-5 border-t border-gray-100 dark:border-gray-700/40" />

                {/* Body */}
                <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">
                    {children}
                </div>

                {/* Footer */}
                {renderFooter()}
            </div>
        </div>,
        document.getElementById('root') || document.body,
    );
};

export default CrumiModal;
