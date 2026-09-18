import { canonicalRegistry } from "./generated/registry.ts";
import { ContractError } from "./errors.ts";

export { canonicalRegistry };

export function sentinelById(id: string) {
  return canonicalRegistry.sentinels.find((sentinel) => sentinel.id === id);
}

export function conceptByCode(code: string) {
  return canonicalRegistry.registeredConcepts.find((concept) => concept.code === code);
}

export function assertRegisteredConcept(code: string, registryVersion: string): void {
  if (registryVersion !== canonicalRegistry.version) {
    throw new ContractError("REGISTRY_VERSION_MISMATCH", `Expected registry ${canonicalRegistry.version}; received ${registryVersion}.`);
  }
  if (!conceptByCode(code)) {
    throw new ContractError("UNREGISTERED_CONCEPT", `Concept ${code} is not registered in ${registryVersion}.`);
  }
}

export function assertRegistryIntegrity(): void {
  const duplicate = <T>(values: readonly T[]) => values.find((value, index) => values.indexOf(value) !== index);
  const duplicates = [
    duplicate(canonicalRegistry.operations),
    duplicate(canonicalRegistry.temporalFrames),
    duplicate(canonicalRegistry.responseKinds),
    duplicate(canonicalRegistry.interactionModes),
    duplicate(canonicalRegistry.predicateOps),
    duplicate(canonicalRegistry.evidenceActionKinds),
    duplicate(canonicalRegistry.questionDeploymentStates),
    duplicate(canonicalRegistry.questionValidationRules),
  ].filter(Boolean);
  if (duplicates.length) throw new ContractError("REGISTRY_DUPLICATE", "Canonical registry contains duplicate values.", duplicates.map(String));
  if (canonicalRegistry.missingness.personFacing.includes("source_unavailable" as never) || canonicalRegistry.missingness.personFacing.includes("not_asked" as never)) {
    throw new ContractError("REGISTRY_MISSINGNESS_SCOPE", "not_asked and source_unavailable cannot be person-facing.");
  }
  const acquisitionOnly = canonicalRegistry.missingness.acquisitionOnly;
  if (acquisitionOnly.length !== 2 || !acquisitionOnly.includes("not_asked") || !acquisitionOnly.includes("source_unavailable")) {
    throw new ContractError("REGISTRY_MISSINGNESS_SCOPE", "Acquisition-only missingness must contain exactly not_asked and source_unavailable.");
  }
  if (canonicalRegistry.predicateOps.length !== 17 || canonicalRegistry.evidenceActionKinds.length !== 8 || canonicalRegistry.questionDeploymentStates.length !== 6) {
    throw new ContractError("REGISTRY_INHERITANCE_DRIFT", "Predicate, evidence-action, or deployment-state registry drifted from v3.2.");
  }
}
