import React from "react";
import { Button } from "reactstrap";

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Evita pantalla en blanco si un hijo lanza en render.
 * Muestra mensaje y enlace para recargar o volver.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-content p-4">
          <div className="text-center py-5">
            <h4 className="text-danger mb-3">Algo falló en esta página</h4>
            <p className="text-muted mb-4">
              Si el problema continúa, recarga o vuelve al inicio.
            </p>
            {this.state.error && (
              <div className="alert alert-danger text-start mx-auto" style={{ maxWidth: 600, fontSize: 12 }}>
                <strong>Error:</strong> {this.state.error.message}
                <pre className="mt-2 mb-0" style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.stack}
                </pre>
              </div>
            )}
            <div className="d-flex gap-2 justify-content-center flex-wrap mt-3">
              <Button color="primary" onClick={() => window.location.reload()}>
                Recargar
              </Button>
              <Button color="secondary" onClick={() => { window.location.href = "/dashboard"; }}>
                Ir al inicio
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
