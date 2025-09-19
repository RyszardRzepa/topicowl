import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Loader2 } from "lucide-react";
import type { EditFormState } from "./types";

interface EditArticleDialogProps {
  readonly open: boolean;
  readonly form: EditFormState;
  readonly isUpdating: boolean;
  readonly onOpenChange: Dispatch<SetStateAction<boolean>>;
  readonly onFormChange: Dispatch<SetStateAction<EditFormState>>;
  readonly onSubmit: () => Promise<void>;
}

export function EditArticleDialog({
  open,
  form,
  isUpdating,
  onOpenChange,
  onFormChange,
  onSubmit,
}: EditArticleDialogProps) {
  const titleDisabled = form.title.trim().length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Scheduled Article</DialogTitle>
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
              placeholder="Article title"
              disabled={isUpdating}
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
              disabled={isUpdating}
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
              className="min-h-[80px] resize-none"
              disabled={isUpdating}
            />
          </div>
          <div>
            <label className="text-foreground mb-2 block text-sm font-medium">
              Scheduled Time
            </label>
            <DateTimePicker
              value={form.scheduledAt ?? undefined}
              onChange={(nextDate) =>
                onFormChange((current) => ({
                  ...current,
                  scheduledAt: nextDate ?? null,
                }))
              }
              minDate={new Date(Date.now() + 60_000)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={() => { void onSubmit(); }}
            disabled={isUpdating || titleDisabled || !form.scheduledAt}
          >
            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isUpdating ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
