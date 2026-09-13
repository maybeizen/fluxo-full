import { DownloadIcon } from "lucide-react";
import { downloadTextFile } from "@/features/settings/download";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function BackupCodesPanel({ codes }: { codes: string[] }) {
  const { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.backup.title")}</CardTitle>
        <CardDescription>{t("settings.backup.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid gap-2 rounded-lg bg-muted/40 p-3 font-mono text-sm sm:grid-cols-2">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadTextFile("fluxo-backup-codes.txt", `${codes.join("\n")}\n`)}
          >
            <DownloadIcon data-icon="inline-start" />
            {t("settings.backup.download")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
