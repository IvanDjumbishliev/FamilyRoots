import { TextField } from '@/components/TextField';
import { Type } from '@/components/Type';

type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function EmailField({ value, onChange, error }: FieldProps) {
  return (
    <TextField
      label="Email"
      value={value}
      onChangeText={onChange}
      error={error}
      autoCapitalize="none"
      autoComplete="email"
      keyboardType="email-address"
      maxLength={254}
    />
  );
}

export function PasswordField({
  value,
  onChange,
  error,
  existing,
}: FieldProps & { existing?: boolean }) {
  return (
    <TextField
      label={existing ? 'Password' : 'New password'}
      value={value}
      onChangeText={onChange}
      error={error}
      hint={existing ? undefined : 'Use at least 12 characters.'}
      secureTextEntry
      autoCapitalize="none"
      autoComplete={existing ? 'current-password' : 'new-password'}
      maxLength={existing ? undefined : 72}
    />
  );
}

export function CodeField({ value, onChange, error }: FieldProps) {
  return (
    <TextField
      label="Email code"
      value={value}
      onChangeText={onChange}
      error={error}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
    />
  );
}

export function RequestError({ message }: { message: string }) {
  return message ? (
    <Type tone="danger" accessibilityRole="alert">
      {message}
    </Type>
  ) : null;
}
