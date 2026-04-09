import { ManifestProvider } from "@/context/ManifestContext";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <PatientShell />
  </ManifestProvider>
);

export default Index;
