import { useForm } from 'react-hook-form';
import type { FieldValues, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Simplified form hook for basic usage
export function useAppForm(options: any = {}) {
  const { schema, ...formOptions } = options;

  return useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    mode: 'onChange' as const,
    ...formOptions,
  });
}

// Utility types for better form field typing
export type FormFieldProps<T extends FieldValues, K extends Path<T>> = {
  name: K;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

// Common validation schemas
import { z } from 'zod';

export const commonSchemas = {
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  required: (fieldName: string) => z.string().min(1, `${fieldName} is required`),
  url: z.string().url('Please enter a valid URL'),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Please enter a valid phone number'),
};