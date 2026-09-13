import { create } from "zustand";

export interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) => {
    set({ sidebarOpen });
  },
}));
