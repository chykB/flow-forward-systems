import type {
  LifecycleStage,
  RiskLevel,
} from "@/lib/client-workflow-types";

export function getLifecycleStageLabel(
  stage: LifecycleStage,
) {
  if (stage === "Won client") {
    return "Engagement confirmed";
  }

  if (stage === "At risk") {
    return "Relationship at risk";
  }

  return stage;
}

export function getRelationshipConcernLabel(
  riskLevel: RiskLevel,
) {
  return `${riskLevel} relationship concern`;
}
