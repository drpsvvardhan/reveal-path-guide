import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { QueueProvider } from "@/context/QueueContext";
import { DerivedPatternsProvider } from "@/context/DerivedPatternsContext";
import { NarrativeProvider } from "@/context/NarrativeContext";
import { LabUploadsProvider } from "@/context/LabUploadsContext";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <DocumentProvider>
      <QueueProvider>
        <LabUploadsProvider>
          <DerivedPatternsProvider>
            <NarrativeProvider>
              <PatientShell />
            </NarrativeProvider>
          </DerivedPatternsProvider>
        </LabUploadsProvider>
      </QueueProvider>
    </DocumentProvider>
  </ManifestProvider>
);

export default Index;
