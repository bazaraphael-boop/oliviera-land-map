import { toast } from "sonner";
import { useNotifications } from "@/contexts/NotificationContext";
import { useCallback } from "react";

type NotifyType = "success" | "error" | "info" | "warning";

export const useNotify = () => {
  const { addNotification } = useNotifications();

  const notify = useCallback(
    (title: string, message: string, type: NotifyType = "info") => {
      // Add to notification bell
      addNotification({ title, message, type });

      // Show toast
      switch (type) {
        case "success":
          toast.success(title, { description: message });
          break;
        case "error":
          toast.error(title, { description: message });
          break;
        case "warning":
          toast.warning(title, { description: message });
          break;
        default:
          toast.info(title, { description: message });
      }
    },
    [addNotification]
  );

  return { notify };
};
