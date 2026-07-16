import toast from "react-hot-toast";
import type { CSSProperties } from "react";
import { TOAST_DURATION } from "../animations/config";

const baseStyle: CSSProperties = {
  background: "#14171F",
  color: "#E8E9ED",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: 500,
  padding: "10px 14px",
};

export function toastSuccess(message: string): void {
  toast.success(message, {
    duration: TOAST_DURATION.success,
    style: baseStyle,
    iconTheme: { primary: "#C9A44C", secondary: "#0B0D12" },
  });
}

export function toastError(message: string): void {
  toast.error(message, {
    duration: TOAST_DURATION.error,
    style: baseStyle,
    iconTheme: { primary: "#EF4444", secondary: "#0B0D12" },
  });
}

export function toastInfo(message: string): void {
  toast(message, {
    duration: TOAST_DURATION.info,
    style: baseStyle,
    icon: "ℹ️",
  });
}
