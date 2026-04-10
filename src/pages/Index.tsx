import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { QueueProvider } from "@/context/QueueContext";
import { ActionCompletionProvider } from "@/context/ActionCompletionContext";
import { DerivedPatternsProvider } from "@/context/DerivedPatternsContext";
import { NarrativeProvider } from "@/context/NarrativeContext";
import { LabUploadsProvider } from "@/context/LabUploadsContext";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <DocumentProvider>
      <QueueProvider>
        <ActionCompletionProvider>
          <DerivedPatternsProvider>
            <NarrativeProvider>
              <LabUploadsProvider>
                <PatientShell />
              </LabUploadsProvider>
            </NarrativeProvider>
          </DerivedPatternsProvider>
        </ActionCompletionProvider>
      </QueueProvider>
    </DocumentProvider>
  </ManifestProvider>
);

export default Index;
