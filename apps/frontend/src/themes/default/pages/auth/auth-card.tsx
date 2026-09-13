import type { ReactNode } from "react";
import { useUI } from "@/theme-system/use-ui";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } = useUI();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? <CardFooter className="justify-center">{footer}</CardFooter> : null}
    </Card>
  );
}
