"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useCredits } from "@/hooks/use-credits";

interface CreditContextType {
  credits: number | null;
  loading: boolean;
  error: string | null;
  refreshCredits: () => Promise<void>;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

interface CreditProviderProps {
  children: ReactNode;
}

export function CreditProvider({ children }: CreditProviderProps) {
  const creditData = useCredits();

  return (
    <CreditContext.Provider value={creditData}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCreditContext() {
  const context = useContext(CreditContext);
  if (context === undefined) {
    throw new Error("useCreditContext must be used within a CreditProvider");
  }
  return context;
}
