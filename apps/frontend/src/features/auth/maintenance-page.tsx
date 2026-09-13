import { WrenchIcon } from "lucide-react";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useT, useUI } from "@/theme-system";
import { BrandMark } from "@/components/layout/brand-mark";

export function MaintenancePage() {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } = useUI();
  const t = useT();
  const settings = usePublicSettings();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <BrandMark className="font-heading text-xl tracking-tight italic" />
          <div className="h-px w-12 bg-primary" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.maintenance.title")}</CardTitle>
            <CardDescription>{t("auth.maintenance.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <WrenchIcon />
              <AlertTitle>{t("auth.maintenance.title")}</AlertTitle>
              <AlertDescription>
                {settings.appMaintenanceMessage.trim().length > 0
                  ? settings.appMaintenanceMessage
                  : t("auth.maintenance.default")}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
