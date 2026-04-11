import { ManifestProvider } from "@/context/ManifestContext";
import { DocumentProvider } from "@/context/DocumentContext";
import { QueueProvider } from "@/context/QueueContext";
import { ActionCompletionProvider } from "@/context/ActionCompletionContext";
import { DerivedPatternsProvider } from "@/context/DerivedPatternsContext";
import { NarrativeProvider } from "@/context/NarrativeContext";
import { LabUploadsProvider } from "@/context/LabUploadsContext";
import { SignatureColorProvider } from "@/context/SignatureColorContext";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { IntakeProvider } from "@/context/IntakeContext";
import OnboardingGate from "@/components/onboarding/OnboardingGate";
import PatientShell from "@/components/PatientShell";

const Index = () => (
  <ManifestProvider>
    <IntakeProvider>
      <DocumentProvider>
        <QueueProvider>
          <ActionCompletionProvider>
            <LabUploadsProvider>
              <DerivedPatternsProvider>
                <SignatureColorProvider>
                  <NarrativeProvider>
                    <OnboardingProvider>
                      <OnboardingGate>
                        <PatientShell />
                      </OnboardingGate>
                    </OnboardingProvider>
                  </NarrativeProvider>
                </SignatureColorProvider>
              </DerivedPatternsProvider>
            </LabUploadsProvider>
          </ActionCompletionProvider>
        </QueueProvider>
      </DocumentProvider>
    </IntakeProvider>
  </ManifestProvider>
);

export default Index;
