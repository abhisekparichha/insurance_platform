"""Canonical policy schema definitions for product categories."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, List, Mapping, Optional


@dataclass(frozen=True)
class PolicySectionDefinition:
    """Definition of a canonical section within a policy document."""

    name: str
    aliases: List[str] = field(default_factory=list)
    required: bool = True


@dataclass(frozen=True)
class PolicySchema:
    """Schema grouping for a specific product category."""

    category: str
    version: str
    sections: List[PolicySectionDefinition]


def _build_schema(
    category: str, version: str, sections: Iterable[PolicySectionDefinition]
) -> PolicySchema:
    return PolicySchema(category=category, version=version, sections=list(sections))


POLICY_SCHEMAS: Mapping[str, PolicySchema] = {
    "health": _build_schema(
        "health",
        "1.0",
        [
            PolicySectionDefinition("Key Features", ["key features", "key highlights"]),
            PolicySectionDefinition("Eligibility", ["eligibility", "who can buy"]),
            PolicySectionDefinition(
                "Coverage",
                ["coverage", "benefits covered", "inclusions", "sum insured"],
            ),
            PolicySectionDefinition("Exclusions", ["exclusions", "what is not covered"]),
            PolicySectionDefinition(
                "Waiting Periods", ["waiting periods", "waiting period"]
            ),
            PolicySectionDefinition("Premium Illustration", ["premium", "premium chart"]),
            PolicySectionDefinition("Renewal", ["renewal"]),
            PolicySectionDefinition("Claims", ["claim process", "claims"]),
        ],
    ),
    "motor": _build_schema(
        "motor",
        "1.0",
        [
            PolicySectionDefinition("Key Features", ["key features", "highlights"]),
            PolicySectionDefinition("Eligibility", ["eligibility", "who can buy"]),
            PolicySectionDefinition(
                "Coverage",
                ["coverage", "benefits", "own damage cover", "liability cover"],
            ),
            PolicySectionDefinition("Add-ons", ["add-ons", "optional covers"]),
            PolicySectionDefinition("Exclusions", ["exclusions"]),
            PolicySectionDefinition("Claims", ["claims", "claim process"]),
            PolicySectionDefinition("Premium Illustration", ["premium"]),
        ],
    ),
    "life_term": _build_schema(
        "life_term",
        "1.0",
        [
            PolicySectionDefinition("Key Features", ["key features", "highlights"]),
            PolicySectionDefinition("Eligibility", ["eligibility", "entry age"]),
            PolicySectionDefinition(
                "Plan Options", ["plan options", "plan variants", "coverage options"]
            ),
            PolicySectionDefinition(
                "Benefits",
                ["benefits", "death benefit", "maturity benefit", "survival benefit"],
            ),
            PolicySectionDefinition("Exclusions", ["exclusions", "suicide clause"]),
            PolicySectionDefinition("Premium Payment", ["premium payment", "premium"]),
            PolicySectionDefinition("Policy Term", ["policy term", "term options"]),
            PolicySectionDefinition("Claims", ["claims", "claim process"]),
        ],
    ),
    "life_savings": _build_schema(
        "life_savings",
        "1.0",
        [
            PolicySectionDefinition("Key Features", ["key features", "highlights"]),
            PolicySectionDefinition("Eligibility", ["eligibility", "entry age"]),
            PolicySectionDefinition(
                "Plan Options", ["plan options", "policy options", "policy variants"]
            ),
            PolicySectionDefinition(
                "Benefits",
                ["benefits", "maturity benefit", "survival benefit", "death benefit"],
            ),
            PolicySectionDefinition("Bonus", ["bonus", "participation in profits"]),
            PolicySectionDefinition("Premium Payment", ["premium payment"]),
            PolicySectionDefinition("Surrender Value", ["surrender value", "loan"]),
            PolicySectionDefinition("Claims", ["claims"]),
        ],
    ),
}


def get_schema(category: str) -> Optional[PolicySchema]:
    """Return the canonical schema for a given category, if present."""
    return POLICY_SCHEMAS.get(category)


def list_supported_categories() -> List[str]:
    """List categories with canonical schema definitions."""
    return sorted(POLICY_SCHEMAS.keys())
