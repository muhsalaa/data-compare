import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import TrendingUp from "lucide-react/dist/esm/icons/trending-up";
import TrendingDown from "lucide-react/dist/esm/icons/trending-down";
import Minus from "lucide-react/dist/esm/icons/minus";

export interface StatCardData {
  key: string;
  label: string;
  latestValue: number | null;
  previousValue: number | null;
  error?: string | null;
}

interface StatCardsProps {
  cards?: StatCardData[];
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

function Delta({
  latest,
  previous,
}: {
  latest: number | null;
  previous: number | null;
}) {
  if (latest === null)
    return (
      <Minus className="size-3 text-muted-foreground" aria-label="No data" />
    );

  if (previous === null || previous === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const diff = latest - previous;
  const pct = (diff / Math.abs(previous)) * 100;

  if (diff === 0)
    return (
      <Minus className="size-3 text-muted-foreground" aria-label="No change" />
    );

  const isUp = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ${
        isUp ? "text-success" : "text-destructive"
      }`}
    >
      {isUp ? (
        <TrendingUp
          className="size-3"
          aria-label={`Up ${Math.abs(pct).toFixed(1)}%`}
        />
      ) : (
        <TrendingDown
          className="size-3"
          aria-label={`Down ${Math.abs(pct).toFixed(1)}%`}
        />
      )}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export const StatCards = memo(function StatCards({ cards }: StatCardsProps) {
  if (!cards || cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.key} className="py-">
          <CardContent className="p-2.5 ">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <p className="truncate text-xs text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-base font-semibold tabular-nums leading-tight">
                  {card.latestValue !== null
                    ? formatNumber(card.latestValue)
                    : "—"}
                </p>
              </div>
              {card.error ? (
                <span
                  className="inline-flex size-2 shrink-0 rounded-full bg-destructive"
                  role="status"
                  aria-label={`Error: ${card.error}`}
                  title={card.error}
                />
              ) : null}
            </div>
            <Delta latest={card.latestValue} previous={card.previousValue} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
});
