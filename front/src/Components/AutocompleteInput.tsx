// src/components/AutocompleteInput.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface AutocompleteOption {
    value: string;
    label: string;
    sublabel?: string;
}

interface AutocompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    options: AutocompleteOption[];
    placeholder?: string;
    style?: React.CSSProperties;
    disabled?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
    value,
    onChange,
    options,
    placeholder = '',
    style = {},
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input value with prop
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Filter options based on input
    const filteredOptions = useMemo(() => {
        if (!inputValue) return options;
        const searchTerm = inputValue.toLowerCase();
        return options.filter(
            opt =>
                opt.label.toLowerCase().includes(searchTerm) ||
                opt.value.toLowerCase().includes(searchTerm) ||
                (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm))
        );
    }, [inputValue, options]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        onChange(newValue);
        setIsOpen(true);
        setHighlightedIndex(-1);
    };

    const handleOptionClick = (option: AutocompleteOption) => {
        setInputValue(option.value);
        onChange(option.value);
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setIsOpen(true);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredOptions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
                    handleOptionClick(filteredOptions[highlightedIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                break;
        }
    };

    const styles: { [key: string]: React.CSSProperties } = {
        wrapper: {
            position: 'relative',
            width: '100%'
        },
        input: {
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            padding: '9px 12px',
            fontSize: '13px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
            ...style
        },
        dropdown: {
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            marginTop: '4px',
            maxHeight: '200px',
            overflowY: 'auto',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        },
        option: {
            padding: '10px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            borderBottom: '1px solid #f3f4f6',
            transition: 'background-color 0.15s'
        },
        optionHighlighted: {
            backgroundColor: '#e0e7ff'
        },
        optionLabel: {
            fontWeight: 500,
            color: '#111827'
        },
        optionSublabel: {
            fontSize: '11px',
            color: '#6b7280',
            marginTop: '2px'
        },
        noResults: {
            padding: '12px',
            fontSize: '13px',
            color: '#9ca3af',
            textAlign: 'center'
        }
    };

    return (
        <div ref={wrapperRef} style={styles.wrapper}>
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                style={styles.input}
                autoComplete="off"
            />
            {isOpen && !disabled && (
                <div style={styles.dropdown}>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option, index) => (
                            <div
                                key={option.value + index}
                                style={{
                                    ...styles.option,
                                    ...(index === highlightedIndex ? styles.optionHighlighted : {})
                                }}
                                onClick={() => handleOptionClick(option)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            >
                                <div style={styles.optionLabel}>{option.label}</div>
                                {option.sublabel && (
                                    <div style={styles.optionSublabel}>{option.sublabel}</div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div style={styles.noResults}>Sin resultados</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AutocompleteInput;
