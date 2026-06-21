import { Card, CardContent } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center">
          <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Under Maintenance</h1>
          <p className="text-muted-foreground">
            MarketPulse is temporarily unavailable while we perform scheduled maintenance.
            Please check back shortly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
