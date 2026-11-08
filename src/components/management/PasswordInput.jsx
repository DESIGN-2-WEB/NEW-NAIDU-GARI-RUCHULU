import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** A password box with a show / hide button. */
export default function PasswordInput({ id, value, onChange, disabled, placeholder, autoComplete = 'new-password' }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mgmt-password">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={72}
      />
      <button
        type="button"
        className="mgmt-icon-btn"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        tabIndex={-1}
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
