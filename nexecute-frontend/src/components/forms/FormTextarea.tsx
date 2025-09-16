import type { UseFormRegister, FieldValues, Path, FieldError } from 'react-hook-form';
import { cn } from '../../utils/cn';

interface FormTextareaProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
  description?: string;
}

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  register,
  error,
  placeholder,
  required,
  disabled,
  rows = 3,
  className,
  description,
}: FormTextareaProps<T>) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={name} className="block text-sm font-medium text-secondary-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {description && (
        <p className="text-sm text-secondary-600">{description}</p>
      )}
      
      <textarea
        id={name}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-secondary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm resize-none',
          error
            ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
            : 'border-secondary-300 text-secondary-900',
          disabled && 'bg-secondary-50 text-secondary-500 cursor-not-allowed'
        )}
        {...register(name)}
      />
      
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error.message}
        </p>
      )}
    </div>
  );
}