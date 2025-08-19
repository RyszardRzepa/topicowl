"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  minDate,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [timeValue, setTimeValue] = React.useState<string>(
    value ? format(value, "HH:mm") : "09:00"
  );

  React.useEffect(() => {
    if (value) {
      setSelectedDate(value);
      setTimeValue(format(value, "HH:mm"));
    }
  }, [value]);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      setSelectedDate(newDate);
      // Only propagate if respects minDate, otherwise wait for valid time
      if (!minDate || newDate >= minDate) {
        onChange(newDate);
      }
    } else {
      setSelectedDate(undefined);
      onChange(undefined);
    }
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      setSelectedDate(newDate);
      if (!minDate || newDate >= minDate) {
        onChange(newDate);
      }
    }
  };

  const getSelectedDateTime = () => {
    if (!selectedDate) return undefined;
    const [hours, minutes] = timeValue.split(":").map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return dt;
  };

  const handleConfirm = () => {
    const finalDate = getSelectedDateTime();
    if (finalDate && (!minDate || finalDate >= minDate)) {
      onChange(finalDate);
      setOpen(false);
    }
  };

  const selectedDateTime = getSelectedDateTime();
  const sameDayAsMin = !!(minDate && selectedDate && isSameDay(selectedDate, minDate));
  const minTimeForSelectedDay = sameDayAsMin && minDate ? format(minDate, "HH:mm") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP 'at' HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              // Effective minimum calendar day is start of minDate's day if provided, else today
              const todayStart = new Date();
              todayStart.setHours(0, 0, 0, 0);
              const effectiveMinDay = minDate
                ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())
                : todayStart;
              return date < effectiveMinDay; // allow selecting current day even if minDate is today but earlier time
            }}
            autoFocus
          />
          <div className="flex items-center space-x-2 px-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <input
              type="time"
              value={timeValue}
              min={minTimeForSelectedDay}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end space-x-2 px-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!selectedDate || (minDate ? !selectedDateTime || selectedDateTime < minDate : false)}
            >
              Confirm
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}