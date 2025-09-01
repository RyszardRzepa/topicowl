import { ArticleCalendarView } from "@/components/articles/calendar/ArticleCalendarView";

export default function ArticlesPage() {
  return (
    <div className="h-[calc(100vh-120px)]">
      <ArticleCalendarView className="h-full" />
    </div>
  );
}
