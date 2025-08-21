import PlansGrid from "@/components/pricing/plans-grid";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Pricing | ContentBot",
  description: "Simple credit-based pricing for articles, ideas and reddit posts.",
};

export default function PricingPage() {
  return (
    <main className="relative mx-auto flex min-h-[80vh] w-full max-w-6xl flex-col items-center justify-center gap-14 px-4 pb-20 pt-24">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Get Credits</h1>
        <p className="mx-auto max-w-xl text-sm text-muted-foreground md:text-base">
          Pay only for what you use. 10 credits = 1 article. 1 credit = 1 idea or Reddit post.
        </p>
      </div>
      <PlansGrid variant="page" showFeatures className="w-full" />
      <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground md:text-sm">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Credits never expire
      </p>
    </main>
  );
}
