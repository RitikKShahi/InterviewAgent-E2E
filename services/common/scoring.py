from __future__ import annotations

import json
from typing import Any, List, Tuple
from .models import ScoreBreakdown

DEFAULT_SKILLS_WEIGHT = 0.40
DEFAULT_EXP_WEIGHT = 0.30
DEFAULT_EDU_WEIGHT = 0.15
DEFAULT_RELEVANCE_WEIGHT = 0.15

def calculate_resume_score(
    candidate_skills: List[str],
    candidate_years_exp: float,
    candidate_education: List[dict[str, Any]],
    candidate_raw_text: str,
    jd_skills: List[str],
    jd_min_years_exp: float,
    jd_raw_text: str,
    weights: dict[str, float] | None = None
) -> Tuple[float, float, float, float, float, ScoreBreakdown, str, bool]:
    """Calculate explainable, weighted resume match score against a Job Description.

    Returns:
        (overall_score, skills_score, exp_score, edu_score, relevance_score, breakdown, explanation, is_eligible)
    """
    if weights is None:
        weights = {
            "skills": DEFAULT_SKILLS_WEIGHT,
            "experience": DEFAULT_EXP_WEIGHT,
            "education": DEFAULT_EDU_WEIGHT,
            "relevance": DEFAULT_RELEVANCE_WEIGHT,
        }

    cand_skills_set = {s.lower() for s in candidate_skills}
    jd_skills_set = {s.lower() for s in jd_skills}

    # 1. Skills Scoring
    matched_skills = []
    missing_skills = []
    for skill in jd_skills:
        if skill.lower() in cand_skills_set:
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)

    if jd_skills:
        skills_match_pct = round((len(matched_skills) / len(jd_skills)) * 100.0, 1)
    else:
        skills_match_pct = 75.0  # neutral if JD has no explicit skills list

    # 2. Experience Scoring
    req_exp = max(jd_min_years_exp, 1.0)
    found_exp = max(candidate_years_exp, 0.5)
    if found_exp >= req_exp:
        # Exceeds or meets: 90% - 100%
        bonus = min(10.0, (found_exp - req_exp) * 2.5)
        exp_match_pct = round(min(100.0, 90.0 + bonus), 1)
    else:
        # Below requirement: ratio of requirement
        exp_match_pct = round(max(30.0, (found_exp / req_exp) * 85.0), 1)

    # 3. Education Scoring
    edu_match_pct = 80.0
    edu_degree_label = "Technical Background"
    if candidate_education:
        top_edu = candidate_education[0].get("degree", "")
        edu_degree_label = top_edu
        if "ph.d" in top_edu.lower():
            edu_match_pct = 98.0
        elif "master" in top_edu.lower():
            edu_match_pct = 95.0
        elif "bachelor" in top_edu.lower():
            edu_match_pct = 90.0
        elif "associate" in top_edu.lower():
            edu_match_pct = 75.0

    # 4. Domain & Project Relevance Scoring
    # Evaluate keyword overlap between JD and candidate text
    jd_words = set(w.lower() for w in jd_raw_text.split() if len(w) > 4)
    cand_words = set(w.lower() for w in candidate_raw_text.split() if len(w) > 4)
    overlap = len(jd_words.intersection(cand_words))
    relevance_match_pct = round(min(95.0, max(45.0, (overlap / max(len(jd_words), 1)) * 140.0)), 1)

    # 5. Weighted Overall Score
    overall_score = round(
        (skills_match_pct * weights["skills"]) +
        (exp_match_pct * weights["experience"]) +
        (edu_match_pct * weights["education"]) +
        (relevance_match_pct * weights["relevance"]),
        1
    )
    overall_score = min(100.0, max(10.0, overall_score))

    # 6. Strengths and Gaps Synthesis
    strengths = []
    gaps = []

    if skills_match_pct >= 70:
        strengths.append(f"Strong skill alignment matching {len(matched_skills)} key requirements: {', '.join(matched_skills[:4])}")
    elif matched_skills:
        strengths.append(f"Core proficiency demonstrated in: {', '.join(matched_skills[:3])}")

    if found_exp >= req_exp:
        strengths.append(f"{found_exp:.1f} years verified experience meets or exceeds required {req_exp:.1f} years threshold")
    else:
        gaps.append(f"{found_exp:.1f} years experience is below desired {req_exp:.1f} years seniority mark")

    if missing_skills:
        gaps.append(f"Missing explicit resume proof for: {', '.join(missing_skills[:3])}")

    if edu_match_pct >= 90:
        strengths.append(f"Holds relevant formal qualification ({edu_degree_label})")

    if not strengths:
        strengths.append("Foundational technical competencies present in related domains")
    if not gaps:
        gaps.append("No critical missing qualifications identified")

    # 7. Human-readable Match Explanation
    if overall_score >= 85:
        verdict = "Exceptional fit with high alignment across technical skills and verified seniority."
    elif overall_score >= 70:
        verdict = "Strong candidate profile with solid domain competencies and good experience overlap."
    elif overall_score >= 50:
        verdict = "Moderate match with relevant foundation, but has gaps in required technologies or seniority."
    else:
        verdict = "Low match against role requirements; significant gaps in required technical skills and experience."

    match_explanation = f"{verdict} Matched {len(matched_skills)}/{max(len(jd_skills), 1)} skills with {found_exp:.1f} years experience vs {req_exp:.1f} required."

    is_eligible = overall_score >= 45.0

    breakdown = ScoreBreakdown(
        matched_skills=matched_skills,
        missing_skills=missing_skills,
        skills_match_pct=skills_match_pct,
        experience_years_found=found_exp,
        experience_years_required=req_exp,
        experience_match_pct=exp_match_pct,
        education_degree=edu_degree_label,
        education_match_pct=edu_match_pct,
        relevance_match_pct=relevance_match_pct,
        strengths=strengths,
        gaps=gaps
    )

    return (
        overall_score,
        skills_match_pct,
        exp_match_pct,
        edu_match_pct,
        relevance_match_pct,
        breakdown,
        match_explanation,
        is_eligible
    )
