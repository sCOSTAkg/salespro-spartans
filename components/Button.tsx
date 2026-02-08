
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  loading = false,
  icon,
  className = '', 
  disabled,
  ...props 
}) => {
  // Base styles including focus states for accessibility
  const baseStyles = "relative py-3.5 px-6 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-[#6C5DD3]/20";
  
  // Variants matching the Spartan/Dark theme
  const variants = {
    primary: "bg-[#6C5DD3] text-white hover:bg-[#5b4eb5] shadow-lg shadow-[#6C5DD3]/30 hover:shadow-[#6C5DD3]/50 border border-transparent",
    secondary: "bg-white text-[#1A1A1A] hover:bg-slate-50 border border-slate-100 shadow-sm shadow-slate-200/20 hover:shadow-md hover:shadow-slate-200/40",
    outline: "bg-transparent border-2 border-[#6C5DD3] text-[#6C5DD3] hover:bg-[#6C5DD3]/5 shadow-none",
    ghost: "bg-transparent text-slate-500 hover:text-[#6C5DD3] hover:bg-[#6C5DD3]/10 shadow-none",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 hover:shadow-red-500/50 border border-transparent"
  };

  const widthClass = fullWidth ? 'w-full' : 'w-auto';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      type={props.type || 'button'}
      {...props}
    >
      {/* Loading Spinner */}
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          ></circle>
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      
      {/* Icon (if provided and not loading) */}
      {!loading && icon && <span className="text-lg leading-none" aria-hidden="true">{icon}</span>}
      
      {/* Label */}
      <span className={loading ? 'opacity-90' : ''}>{children}</span>
    </button>
  );
};
