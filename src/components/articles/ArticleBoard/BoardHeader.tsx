import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings as SettingsIcon } from "lucide-react";

interface BoardHeaderProps {
  readonly weekStart: Date;
  readonly isBusy: boolean;
  readonly isGeneratingIdeas: boolean;
  readonly onToday: () => void;
  readonly onPrevWeek: () => void;
  readonly onNextWeek: () => void;
  readonly onGenerateIdeas: () => Promise<void>;
}

export function BoardHeader({
  weekStart,
  isBusy,
  isGeneratingIdeas,
  onToday,
  onPrevWeek,
  onNextWeek,
  onGenerateIdeas,
}: BoardHeaderProps) {
  return (
    <header className="border-border bg-card flex items-center justify-between rounded-t-lg border-b p-4">
      <div className="flex items-center gap-4">
        <h2 className="text-foreground text-xl font-bold">Articles Board</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={onPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 flex items-center gap-2">
            <span className="text-foreground text-lg font-medium">
              {format(weekStart, "MMMM yyyy")}
            </span>
            {isBusy && (
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 text-xs md:flex">
          <div className="flex items-center gap-1">
            <span className="bg-chart-4 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Idea</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-chart-3 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Generated</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-chart-1 inline-block size-2.5 rounded-full" />
            <span className="text-muted-foreground">Published</span>
          </div>
        </div>

        <Button size="sm" onClick={() => { void onGenerateIdeas(); }} disabled={isGeneratingIdeas}>
          {isGeneratingIdeas ? (
            <>
              Generating Topics...
            </>
          ) : (
            <>
              <span className="mr-2">✨</span>
              Generate Ideas
            </>
          )}
        </Button>

        <Button asChild variant="ghost" size="icon" aria-label="Settings">
          <a href="/dashboard/settings">
            <SettingsIcon className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </header>
  );
}
