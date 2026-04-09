import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { QueueProvider } from "@/context/QueueContext";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <DocumentProvider>
      <QueueProvider>
        <PatientShell />
      </QueueProvider>
    </DocumentProvider>
  </ManifestProvider>
);

export default Index;
