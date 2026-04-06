import React from 'react';

interface LoaderProps {
  /** Size variant: 'sm' (w-8 h-8), 'md' (w-10 h-10), 'lg' (w-12 h-12) */
  size?: 'sm' | 'md' | 'lg';
  /** Optional loading message to display below the spinner */
  message?: string;
  /** Container padding (vertical padding only). Default: 'py-8' */
  containerPadding?: string;
  /** Whether to center in a flex container */
  centered?: boolean;
}

const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  message = 'Loading...',
  containerPadding = 'py-8',
  centered = true
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const loaderElement = (
    <div
      className={`inline-block ${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 animate-spin`}
      style={{ borderRadius: '15px' }}
    ></div>
  );

  if (centered) {
    return (
      <div className={`flex items-center justify-center ${containerPadding}`}>
        <div className="text-center">
          {loaderElement}
          {message && <p className="text-slate-600 text-sm mt-3">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {loaderElement}
      {message && <p className="text-slate-600 text-sm mt-2">{message}</p>}
    </div>
  );
};

export default Loader;
