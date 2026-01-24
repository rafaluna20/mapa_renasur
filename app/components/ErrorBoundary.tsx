'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log del error a consola
    console.error('Map Error Boundary capturó un error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Aquí podrías enviar el error a un servicio de monitoreo
    // como Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Recargar la página
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Si hay un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI por defecto de error
      return (
        <div className="flex h-full w-full items-center justify-center bg-slate-50 p-8">
          <div className="max-w-md text-center">
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100">
              <AlertTriangle className="text-red-600" size={40} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-3">
              Error al cargar el mapa
            </h2>
            
            <p className="text-slate-600 mb-6">
              Ocurrió un problema inesperado al cargar el mapa interactivo. 
              Por favor, intenta recargar la página.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 mb-2">
                  Detalles técnicos (solo en desarrollo)
                </summary>
                <pre className="text-xs bg-slate-100 p-4 rounded-lg overflow-auto max-h-60 text-red-600">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#A145F5] text-white rounded-lg hover:bg-[#8D32DF] transition-colors font-medium shadow-md hover:shadow-lg"
            >
              <RefreshCw size={20} />
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Error Boundary específico para componentes individuales
export class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Component Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm mb-2">
            Error al cargar este componente
          </p>
          <button
            onClick={this.handleRetry}
            className="text-xs text-red-600 hover:text-red-800 underline"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
