import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { QueueProvider } from "@/context/QueueContext";
import { ActionCompletionProvider } from "@/context/ActionCompletionContext";
import { DerivedPatternsProvider } from "@/context/DerivedPatternsContext";
import { NarrativeProvider } from "@/context/NarrativeContext";
import { LabUploadsProvider } from "@/context/LabUploadsContext";
import { SignatureColorProvider } from "@/context/SignatureColorContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import OnboardingGate from "@/components/onboarding/OnboardingGate";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <OnboardingProvider>
      <OnboardingGate>
        <DocumentProvider>
          <QueueProvider>
            <ActionCompletionProvider>
              <LabUploadsProvider>
                <DerivedPatternsProvider>
                  <SignatureColorProvider>
                    <NarrativeProvider>
                      <PatientShell />
                    </NarrativeProvider>
                  </SignatureColorProvider>
                </DerivedPatternsProvider>
              </LabUploadsProvider>
            </ActionCompletionProvider>
          </QueueProvider>
        </DocumentProvider>
      </OnboardingGate>
    </OnboardingProvider>
  </ManifestProvider>
);

export default Index;
