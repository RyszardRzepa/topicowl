"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PlansGrid from "@/components/pricing/plans-grid";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PricingModal = ({ open, onOpenChange }: PricingModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!sm:w-[45vw] max-h-[92vh] !w-[90vw] !max-w-none overflow-y-auto rounded-xl p-0 focus:outline-none"
        aria-label="Pricing plans dialog"
      >
        <div className="flex w-full flex-col gap-8 p-6 md:p-8">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
              Get Credits
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mx-auto max-w-xl text-center text-sm md:text-base">
              Pay only for what you use.
            </DialogDescription>
          </DialogHeader>
          <PlansGrid variant="modal" showFeatures={true} className="mt-2" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;
