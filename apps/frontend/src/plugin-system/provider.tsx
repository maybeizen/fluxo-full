import { useEffect, type ReactNode } from "react";
import { useSession } from "@/hooks/use-session";
import { isAdminRole } from "@/lib/auth";
import {
  fetchAdminEnabledPanelPluginIds,
  fetchPublicEnabledPanelPluginIds,
} from "./enabled-ids";
import {
  ensurePanelPluginCatalog,
  setEnabledPluginIds,
} from "./registry";

export function PluginSystemProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const admin =
    session.data?.status === "authenticated" &&
    isAdminRole(session.data.user.role);

  useEffect(() => {
    void ensurePanelPluginCatalog();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (admin
      ? fetchAdminEnabledPanelPluginIds()
      : fetchPublicEnabledPanelPluginIds()
    ).then((ids) => {
      if (!cancelled && ids !== undefined) {
        setEnabledPluginIds(ids);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  return children;
}
