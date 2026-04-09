import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <DocumentProvider>
      <PatientShell />
    </DocumentProvider>
  </ManifestProvider>
);

export default Index;
