import { format } from "date-fns";
import type { Dispatch, SetStateAction } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Loader2, Plus } from "lucide-react";
import type { CreateFormState, ScheduleSelection } from "./types";

interface CreateArticleDialogProps {
  readonly open: boolean;
  readonly form: CreateFormState;
  readonly schedule: ScheduleSelection | null;
  readonly isSubmitting: boolean;
  readonly onOpenChange: Dispatch<SetStateAction<boolean>>;
  readonly onFormChange: Dispatch<SetStateAction<CreateFormState>>;
  readonly onScheduleChange: Dispatch<SetStateAction<ScheduleSelection | null>>;
  readonly onSubmit: () => Promise<void>;
}

export function CreateArticleDialog({
  open,
  form,
  schedule,
  isSubmitting,
  onOpenChange,
  onFormChange,
  onScheduleChange,
  onSubmit,
}: CreateArticleDialogProps) {
  const titleDisabled = form.title.trim().length === 0;
  const scheduledDate = schedule
    ? new Date(
        new Date(schedule.date).setHours(schedule.hour, schedule.minute, 0, 0),
      )
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule New Article</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Title
            </label>
            <Input
              value={form.title}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Enter article title..."
              autoFocus
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Keywords (optional)
            </label>
            <Input
              value={form.keywords}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  keywords: event.target.value,
                }))
              }
              placeholder="keyword1, keyword2"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Notes (optional)
            </label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                onFormChange((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Add notes or requirements..."
              className="min-h-[80px] resize-none"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Scheduled Time
            </label>
            <DateTimePicker
              value={scheduledDate ?? undefined}
              onChange={(nextDate) => {
                if (!nextDate) {
                  onScheduleChange(null);
                  return;
                }
                onScheduleChange({
                  date: nextDate,
                  hour: nextDate.getHours(),
                  minute: nextDate.getMinutes(),
                });
              }}
              minDate={new Date(Date.now() + 60_000)}
            />
          </div>
          {scheduledDate ? (
            <div className="text-muted-foreground text-xs">
              Scheduled for {format(scheduledDate, "EEE, MMM d @ h:mma")}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={() => { void onSubmit(); }} disabled={titleDisabled || isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
