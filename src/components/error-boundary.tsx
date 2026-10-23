import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * ErrorBoundary peringkat route — menukar skrin putih (white screen)
 * kepada UI ralat yang boleh dipulihkan (butang cuba semula + navigasi).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // Elak PHI dalam log: hanya mesej ralat generik.
    console.error("[ErrorBoundary]", error.message);
  }

  private retry = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
            <h1 className="text-xl font-bold">Sesuatu tidak kena</h1>
            <p className="text-sm text-muted-foreground">
              Halaman ini gagal dimuatkan. Data anda selamat — sila cuba
              semula atau kembali ke papan pemuka.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.retry}
                className="min-h-11 px-4 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#1877f2" }}
              >
                Cuba Semula
              </button>
              <Link
                to="/"
                className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-semibold border"
              >
                Papan Pemuka
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
