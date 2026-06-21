"use client";

import { useState, useEffect } from "react";
import { INTEREST_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { secureFetch } from "@/lib/api/client";
import type { InterestCategory } from "@prisma/client";

export default function SettingsPage() {
  const [selected, setSelected] = useState<InterestCategory[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.interests) {
          setSelected(json.data.interests.map((i: { category: InterestCategory }) => i.category));
        }
      });
  }, []);

  const toggle = (cat: InterestCategory) => {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setSaved(false);
  };

  const save = async () => {
    await secureFetch("/api/user", {
      method: "PUT",
      body: JSON.stringify({ categories: selected }),
    });
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Market Interests</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select categories to personalize your news feed.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.entries(INTEREST_LABELS) as [InterestCategory, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                    selected.includes(key)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>
          <Button onClick={save} disabled={selected.length === 0}>
            Save interests
          </Button>
          {saved && (
            <p className="text-sm text-accent mt-2">Interests saved successfully.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
