"use client";
import { PRICING_PLANS } from "@/constants";
import { useAuth, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, ShieldCheck, Check } from "lucide-react";

interface PlansGridProps {
  variant?: "modal" | "page"; // controls density/styles
  showFeatures?: boolean;
  className?: string;
}

const CORE_FEATURES = ["Unlimited scheduling", "Ideas, articles & reddit generation", "Credits never expire"];

export default function PlansGrid({ variant = "modal", showFeatures = true, className = "" }: PlansGridProps) {
  const { isLoaded } = useAuth();
  const { isSignedIn } = useUser();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const plans = [
    { key: "STARTER" as const, popular: false, ...PRICING_PLANS.STARTER },
    { key: "WRITER" as const, popular: true, ...PRICING_PLANS.WRITER },
    { key: "PRO" as const, popular: false, ...PRICING_PLANS.PRO },
  ];

  const dense = variant === "modal";

  const handlePurchase = async (planKey: typeof plans[number]["key"]) => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.location.href = "/sign-in?redirect_url=/pricing";
      return;
    }
    setLoadingKey(planKey);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const data = (await res.json()) as { url?: string; message?: string };
      if (data.url) window.location.href = data.url;
      else alert(data.message ?? "Payment system is being set up. Please check back soon!");
    } catch (e) {
      console.error(e);
      alert("Checkout failed. Please try again.");
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className={`grid gap-6 md:grid-cols-3 ${dense ? "lg:gap-8" : "lg:gap-10"} ${className}`}> 
      {plans.map((plan) => {
        return (
          <Card
            key={plan.key}
            tabIndex={0}
            aria-label={`${plan.name} plan: ${plan.credits} credits for $${plan.price}`}
            className={`group relative flex flex-col justify-between overflow-hidden ${dense ? "rounded-3xl" : "rounded-2xl"} transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 ${
              plan.popular && dense
                ? "border-amber-400/60 ring-1 ring-amber-300/60 dark:bg-zinc-900/80"
                : plan.popular
                ? "border-primary/40 bg-gradient-to-b from-primary/5 via-background to-background shadow-sm"
                : "bg-background hover:bg-muted/30"
            }`}
          >
            {plan.popular && (
              <div className="absolute left-0 top-0 flex w-full justify-center pt-3">
                <Badge 
                  className={`rounded-full px-3 border-none py-1 text-xs font-medium  ${
                    dense 
                      ? "bg-amber-400 text-amber-900 dark:text-amber-950"
                      : "bg-primary text-primary-foreground"
                  }`} 
                  aria-label="Most popular plan"
                >
                  Most Popular
                </Badge>
              </div>
            )}
            <CardHeader className={`pb-4 ${dense ? "pt-10 md:pt-12" : "pt-12"} text-center`}>
              <CardTitle className={`font-semibold ${dense ? "text-lg md:text-xl" : "text-xl md:text-2xl"}`}>
                {dense ? `${plan.credits} Credits` : plan.name}
              </CardTitle>
              {!dense && (
                <p className="mx-auto mt-1 max-w-[220px] text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
              )}
              <div className={`${dense ? "mt-6" : "mt-5"} space-y-3`}>
                {!dense && (
                  <div className="flex items-baseline justify-center gap-1">
                    <Coins className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-2xl font-semibold md:text-3xl">{plan.credits}</span>
                    <span className="text-muted-foreground text-xs md:text-sm">credits</span>
                  </div>
                )}
                <div className={`text-primary font-bold ${dense ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"}`}>
                  ${plan.price}
                </div>
                <div className={`text-muted-foreground ${dense ? "text-xs" : "text-xs md:text-sm"}`}>
                  ${plan.pricePerCredit.toFixed(2)} per credit
                </div>
                {plan.discount > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400" aria-label={`Save ${plan.discount} percent`}>
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Save {plan.discount}%
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between pt-0">
              {showFeatures && (
                <>
                  <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center justify-between"><span>Article generations (10 credits)</span><span className="font-medium text-foreground">{Math.floor(plan.credits / 10)}</span></li>
                    <li className="flex items-center justify-between"><span>Reddit posts (5 credits)</span><span className="font-medium text-foreground">{Math.floor(plan.credits / 5)}</span></li>
                    <li className="flex items-center justify-between"><span>Article ideas (1 credit)</span><span className="font-medium text-foreground">{plan.credits}</span></li>
                  </ul>
                  <div className="mb-4 space-y-2">
                    {CORE_FEATURES.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Check className="mt-0.5 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <Button
                className={`mt-auto w-full text-sm md:text-base ${
                  plan.popular && dense
                    ? "bg-amber-400 text-amber-950 hover:bg-amber-400/90"
                    : plan.popular
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-background hover:bg-muted"
                }`}
                size="lg"
                onClick={() => handlePurchase(plan.key)}
                disabled={loadingKey === plan.key}
                aria-label={`Purchase ${plan.name} plan with ${plan.credits} credits`}
                variant={plan.popular ? "default" : "outline"}
              >
                {loadingKey === plan.key ? "Processing..." : `Get ${plan.credits} Credits`}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
