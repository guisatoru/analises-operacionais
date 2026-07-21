import React from 'react';
import SearchableSelect from './searchable-select';

interface Option {
  value: string;
  label: string;
}

interface FormFieldProps {
  label: string;
  id?: string;
  type?: string;
  value: any;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  options?: Option[];
  className?: string;
  min?: number | string;
  step?: string;
}

/**
 * Campo de Formulário Compartilhado (FormField).
 * 
 * Por que existe: Fornece um componente padrão para inputs e selects,
 * garantindo consistência visual de bordas, foco, fontes e espaçamentos
 * entre rótulos e campos de entrada de dados de modais do sistema.
 */
export default function FormField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  options = [],
  className = '',
  min,
  step,
}: FormFieldProps) {
  const inputStyle = "w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white";
  const fieldId = id || `form-field-${label.replace(/\s+/g, '-').toLowerCase()}`;

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1.5"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {type === 'select' ? (
        <SearchableSelect
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder || "Selecione..."}
        />
      ) : (
        <input
          type={type}
          id={fieldId}
          value={value}
          onChange={handleValueChange}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
          className={inputStyle}
        />
      )}
    </div>
  );
}
