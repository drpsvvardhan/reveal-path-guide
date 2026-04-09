import React, { createContext, useContext, useState, useCallback } from "react";

export interface PatientDocument {
  id: string;
  name: string;
  type: string;
  content: string;
  uploadedAt: Date;
  size: number;
}

interface DocumentContextValue {
  documents: PatientDocument[];
  addDocument: (doc: Omit<PatientDocument, "id" | "uploadedAt">) => void;
  removeDocument: (id: string) => void;
  clearDocuments: () => void;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

export const useDocuments = () => {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error("useDocuments must be used within DocumentProvider");
  return ctx;
};

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);

  const addDocument = useCallback((doc: Omit<PatientDocument, "id" | "uploadedAt">) => {
    const newDoc: PatientDocument = {
      ...doc,
      id: crypto.randomUUID(),
      uploadedAt: new Date(),
    };
    setDocuments((prev) => [...prev, newDoc]);
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const clearDocuments = useCallback(() => {
    setDocuments([]);
  }, []);

  return (
    <DocumentContext.Provider value={{ documents, addDocument, removeDocument, clearDocuments }}>
      {children}
    </DocumentContext.Provider>
  );
};
