import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import Toast from "../components/Toast";
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const dismiss = useCallback(
    (id) =>
      setToasts((old) =>
        id === undefined ? [] : old.filter((toast) => toast.id !== id),
      ),
    [],
  );
  const notify = useCallback((message, type = "info") => {
    if (!message) {
      setToasts([]);
      return;
    }
    const toast = {
      id: ++nextId.current,
      message,
      type: ["success", "error", "info"].includes(type) ? type : "info",
    };
    setToasts((old) => [...old.slice(-4), toast]);
    return toast.id;
  }, []);
  return (
    <ToastContext.Provider value={{ notify, dismiss }}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
