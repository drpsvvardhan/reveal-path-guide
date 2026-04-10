import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useDerivedPatterns } from "@/context/DerivedPatternsContext";
import { deriveSignatureColor, SignatureColor } from "@/lib/signatureColor";

interface SignatureColorContextValue {
  color: SignatureColor;
}

const SignatureColorContext = createContext<SignatureColorContextValue | null>(null);

export const useSignatureColor = () => {
  const ctx = useContext(SignatureColorContext);
  if (!ctx) throw new Error("useSignatureColor must be used within SignatureColorProvider");
  return ctx;
};

export const SignatureColorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { patterns } = useDerivedPatterns();
  const color = useMemo(() => deriveSignatureColor(patterns), [patterns]);

  useEffect(() => {
    document.documentElement.style.setProperty("--signature", color.hsl);
  }, [color]);

  return (
    <SignatureColorContext.Provider value={{ color }}>
      {children}
    </SignatureColorContext.Provider>
  );
};
