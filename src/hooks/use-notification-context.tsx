"use client";

import { createContext, useContext } from "react";

interface NotificationContextValue {
  triggerTestNotification: (senderName: string) => void;
}

const defaultValue: NotificationContextValue = {
  triggerTestNotification: () => {},
};

export const NotificationContext = createContext<NotificationContextValue>(defaultValue);

export function useNotificationContext() {
  return useContext(NotificationContext);
}
