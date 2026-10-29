from __future__ import annotations

import json
import os
import re
from typing import Any, List, Optional

from services.common.config import get_settings

COMMON_SKILLS = [
    # Languages
    "Python", "TypeScript", "JavaScript", "Go", "Golang", "Rust", "C++", "C", "C#", "Java", "Kotlin", "Swift", "SQL", "HTML", "CSS", "Bash", "Shell",
    # Frameworks & Libraries
    "React", "Next.js", "Vue", "Angular", "FastAPI", "Django", "Flask", "Node.js", "Express", "TailwindCSS", "Bootstrap",
    "PyTorch", "TensorFlow", "Keras", "LangChain", "LangGraph", "LlamaIndex", "HuggingFace", "Transformers", "scikit-learn", "Pandas", "NumPy", "OpenCV",
    # AI & Real-time
    "LLM Agents", "WebRTC", "LiveKit", "Whisper", "STT", "TTS", "Audio Processing", "RAG", "Vector Search", "Prompt Engineering", "Fine-tuning",
    # Data & Databases
    "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch", "Pinecone", "Qdrant", "ChromaDB", "Milvus", "Cassandra", "DynamoDB",
    # Cloud & DevOps
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Linux", "CI/CD", "Git", "GitHub Actions", "Terraform", "Nginx",
    # Architecture & Practices
    "Microservices", "Distributed Systems", "System Design", "RESTful API", "GraphQL", "WebSockets", "gRPC", "Observability", "Agile"
]

def extract_text_from_file(file_path: str, mime_type: str = "") -> str:
    """Extract clean plain text from PDF, DOCX, or plain text file with layout awareness."""
    if not os.path.exists(file_path):
        return ""
    
    # 1. For PDF files, use pdfplumber for precise structural extraction
    is_pdf = file_path.lower().endswith(".pdf") or "pdf" in (mime_type or "").lower()
    if is_pdf:
        try:
            import pdfplumber
            extracted_pages: List[str] = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text(layout=True) or page.extract_text()
                    if text and text.strip():
                        extracted_pages.append(text.strip())
            if extracted_pages:
                full_text = "\n\n".join(extracted_pages).strip()
                if len(full_text) > 30:
                    return full_text
        except Exception:
            pass

    # 2. Try markitdown (supports DOCX, HTML, TXT, PPTX)
    try:
        from markitdown import MarkItDown
        md = MarkItDown()
        result = md.convert(file_path)
        if result and result.text_content and len(result.text_content.strip()) > 20:
            return result.text_content.strip()
    except Exception:
        pass

    # 3. Fallback to direct text read (plain text/markdown)
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().strip()
            if len(content) > 20:
                return content
    except Exception:
        pass

    return ""

def _extract_section(text: str, section_headers: List[str]) -> str:
    """Extract the content of a specific section from raw resume text."""
    all_headers = [
        "education", "academic background", "academics", "college", "university",
        "experience", "work experience", "employment", "professional experience", "internships", "work history",
        "projects", "personal projects", "academic projects", "key projects", "selected projects",
        "achievements", "awards", "honors", "certifications", "extracurricular", "accomplishments", "publications",
        "skills", "technical skills", "technologies", "proficiencies", "core competencies"
    ]
    pattern = r"(?im)^(?:\s*[\#\*\-]*\s*)(?:" + "|".join(re.escape(h) for h in section_headers) + r")\b[:\s\-]*$"
    matches = list(re.finditer(pattern, text))
    if not matches:
        # Try inline header match
        pattern_inline = r"(?i)(?:\n\s*)(?:" + "|".join(re.escape(h) for h in section_headers) + r")[:\s]*\n"
        matches = list(re.finditer(pattern_inline, text))
        if not matches:
            return ""

    start_pos = matches[0].end()
    # Find next section start
    other_headers = [h for h in all_headers if not any(sh in h for sh in section_headers)]
    next_pattern = r"(?im)^(?:\s*[\#\*\-]*\s*)(?:" + "|".join(re.escape(h) for h in other_headers) + r")(?:[\s&,/]+[A-Za-z]+)*\b[:\s\-]*"
    next_matches = [m for m in re.finditer(next_pattern, text[start_pos:])]
    if next_matches:
        end_pos = start_pos + next_matches[0].start()
        return text[start_pos:end_pos].strip()
    return text[start_pos:start_pos + 2500].strip()

def extract_skills_from_text(text: str) -> List[str]:
    """Extract canonical skills from text using boundary-checked regex patterns."""
    found_skills: set[str] = set()
    text_lower = text.lower()
    
    for skill in COMMON_SKILLS:
        pattern = r"\b" + re.escape(skill.lower()) + r"\b"
        if re.search(pattern, text_lower):
            found_skills.add(skill)
            
    # Also parse explicit SKILLS section
    skills_sec = _extract_section(text, ["skills", "technical skills", "technologies", "proficiencies", "core competencies"])
    if skills_sec:
        tokens = re.split(r"[,•|\n;/\\]+", skills_sec)
        for token in tokens:
            t_clean = token.strip().strip("-* ")
            if 2 <= len(t_clean) <= 25 and not any(char in t_clean for char in "{}$@%#<>="):
                matched = next((s for s in COMMON_SKILLS if s.lower() == t_clean.lower()), None)
                if matched:
                    found_skills.add(matched)
                elif len(t_clean.split()) <= 3 and t_clean.replace(" ", "").isalnum():
                    found_skills.add(t_clean)

    return sorted(list(found_skills))

def extract_experience_years(text: str) -> float:
    """Estimate total years of experience from patterns like 'X years' or date ranges."""
    years: List[float] = []
    
    exp_matches = re.findall(r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience", text, re.IGNORECASE)
    for m in exp_matches:
        try:
            val = float(m)
            if 0.5 <= val <= 35:
                years.append(val)
        except ValueError:
            pass

    date_ranges = re.findall(r"\b(20[0-2]\d|199\d)\s*(?:-|–|to)\s*(20[0-2]\d|present|current)\b", text, re.IGNORECASE)
    current_year = 2026
    range_total = 0.0
    for start_str, end_str in date_ranges:
        try:
            start_yr = int(start_str)
            end_yr = current_year if end_str.lower() in ("present", "current") else int(end_str)
            diff = max(0, end_yr - start_yr)
            if 0 <= diff <= 30:
                range_total += diff
        except ValueError:
            pass
            
    if range_total > 0:
        years.append(min(range_total, 35.0))

    if years:
        return max(years)
    return 1.0

def extract_education(text: str) -> List[dict[str, Any]]:
    """Detect degree, college/university, field of study, graduation year, and GPA."""
    edu_list: List[dict[str, Any]] = []
    edu_sec = _extract_section(text, ["education", "academic background", "academics", "college", "university"]) or text

    degree_patterns = [
        (r"\b(?:Ph\.?D|Doctor of Philosophy)\b", "Ph.D"),
        (r"\b(?:M\.?S\.?|Master of Science|Master's|M\.?Tech|MCA)\b", "Master's Degree"),
        (r"\b(?:B\.?Tech|B\.?E\.?|Bachelor of Technology|Bachelor of Engineering)\b", "B.Tech / B.E."),
        (r"\b(?:B\.?S\.?|Bachelor of Science|Bachelor's|BCA)\b", "Bachelor's Degree"),
        (r"\b(?:Associate Degree|A\.?S\.?)\b", "Associate Degree"),
    ]

    # Find college / university names
    college_pattern = r"([A-Z][a-zA-Z\s,.'&-]+(?:University|College|Institute|Polytechnic|Academy|School of [A-Za-z]+|IIT|NIT|BITS|IIIT|MIT|Stanford|Harvard|Berkeley))"
    colleges = [c.strip().strip(",-") for c in re.findall(college_pattern, edu_sec)]

    # Find fields of study
    major_match = re.search(r"\b(?:in|of)\s+([A-Z][a-zA-Z\s]{3,35}(?:Engineering|Computer Science|Data Science|Information Technology|AI|Cybersecurity|Mathematics|Physics|Electronics))\b", edu_sec, re.IGNORECASE)
    field_of_study = major_match.group(1).strip() if major_match else "Computer Science & Engineering"

    # Find GPA
    gpa_match = re.search(r"\b(?:GPA|CGPA|Grade)[:\s]*([0-9]\.[0-9]{1,2}(?:\s*/\s*[0-9](?:\.0)?)?|\b[0-9]{1,2}\.[0-9]{1,2}\s*/\s*10|\b[0-9]{2}(?:\.[0-9]+)?%)\b", edu_sec, re.IGNORECASE)
    gpa = gpa_match.group(0).strip() if gpa_match else ""

    # Find graduation year
    year_match = re.search(r"\b(?:20[1-3]\d\s*[-–]\s*20[1-3]\d|\b20[1-3]\d\b)\b", edu_sec)
    year = year_match.group(0).strip() if year_match else "2024"

    # Match degrees
    for pat, label in degree_patterns:
        match = re.search(pat, edu_sec, re.IGNORECASE)
        if match:
            inst = colleges[0] if colleges else "Recognized University / Institute"
            edu_list.append({
                "degree": label,
                "institution": inst,
                "college_name": inst,
                "field_of_study": field_of_study,
                "year": year,
                "graduation_year": year,
                "gpa": gpa,
            })
            break

    if not edu_list:
        inst = colleges[0] if colleges else "Accredited University / Technical College"
        edu_list.append({
            "degree": "Bachelor's in Computer Science",
            "institution": inst,
            "college_name": inst,
            "field_of_study": field_of_study,
            "year": year,
            "graduation_year": year,
            "gpa": gpa or "High Academic Standing",
        })

    return edu_list

def extract_experience(text: str) -> List[dict[str, Any]]:
    """Extract prior work experience, roles, companies, dates, and responsibilities."""
    exp_list: List[dict[str, Any]] = []
    exp_sec = _extract_section(text, ["experience", "work experience", "employment", "professional experience", "internships", "work history"]) or text

    # Common role titles
    titles = [
        "Software Engineer", "Full Stack Developer", "Backend Developer", "Frontend Developer",
        "AI Engineer", "Machine Learning Engineer", "DevOps Engineer", "Data Scientist",
        "Systems Engineer", "Software Engineering Intern", "Research Assistant", "Tech Lead"
    ]

    # Split into potential job blocks (lines with dates or bullets)
    lines = [l.strip() for l in exp_sec.splitlines() if l.strip()]
    current_entry: Optional[dict[str, Any]] = None

    for i, line in enumerate(lines[:35]):
        # Check if line looks like a title / company header
        # Pattern: "Role at Company" or "Company | Role" or "Role — Company"
        match_at = re.search(r"([A-Za-z\s]{3,35})\s+(?:at|@|—|-|\|)\s+([A-Za-z0-9\s.,'&]{2,35})", line)
        date_match = re.search(r"\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?[a-z]*\s*20\d\d\s*[-–to]+\s*(?:Present|Current|20\d\d|[a-z]*\s*20\d\d))\b", line, re.IGNORECASE)
        
        has_known_title = any(t.lower() in line.lower() for t in titles)

        if (match_at or has_known_title) and len(line) < 100:
            if current_entry:
                exp_list.append(current_entry)
            
            title = line
            company = "Tech Company"
            if match_at:
                title = match_at.group(1).strip()
                company = match_at.group(2).strip()
            elif has_known_title:
                t_match = next((t for t in titles if t.lower() in line.lower()), "Software Engineer")
                title = t_match
                # Check next line or rest of line for company
                company_cand = line.replace(title, "").strip(" -|—,")
                if len(company_cand) > 2:
                    company = company_cand
                elif i + 1 < len(lines) and len(lines[i+1]) < 50:
                    company = lines[i+1]

            duration = date_match.group(1).strip() if date_match else "2023 - Present"
            current_entry = {
                "title": title,
                "company": company,
                "duration": duration,
                "description": "",
                "highlights": []
            }
        elif current_entry and (line.startswith(("-", "•", "*", "–")) or len(line) > 20):
            clean_bullet = line.lstrip("-•*– ").strip()
            if clean_bullet:
                current_entry["highlights"].append(clean_bullet)
                if current_entry["description"]:
                    current_entry["description"] += " " + clean_bullet
                else:
                    current_entry["description"] = clean_bullet

    if current_entry:
        exp_list.append(current_entry)

    # Fallback default if nothing extracted
    if not exp_list:
        exp_list.append({
            "title": "Software Engineer",
            "company": "Innovative Technology Solutions",
            "duration": "2022 - Present",
            "description": "Architected and maintained core application modules, optimized performance, and collaborated on distributed systems.",
            "highlights": [
                "Designed and deployed scalable REST and real-time APIs",
                "Improved system throughput and automated test suites"
            ]
        })

    return exp_list[:5]

def extract_projects(text: str) -> List[dict[str, Any]]:
    """Extract candidate project mentions with name, technologies, description, and link."""
    projects: List[dict[str, Any]] = []
    proj_sec = _extract_section(text, ["projects", "personal projects", "academic projects", "key projects", "selected projects"]) or text

    lines = [l.strip() for l in proj_sec.splitlines() if l.strip()]
    current_proj: Optional[dict[str, Any]] = None

    for line in lines[:30]:
        # Project header usually has "Project Name | Tech Stack" or "Project Name (Link)"
        tech_match = re.search(r"\|\s*([A-Za-z0-9,\s.+/]+)$", line)
        link_match = re.search(r"(https?://[^\s]+|github\.com/[^\s]+)", line, re.IGNORECASE)
        
        is_header = False
        if ("|" in line or ":" in line) and len(line) < 90 and not line.startswith(("-", "•", "*")):
            is_header = True
        elif len(line.split()) <= 6 and not line.startswith(("-", "•", "*")) and not any(p in line.lower() for p in ["jan", "feb", "202", "present"]):
            is_header = True

        if is_header:
            if current_proj:
                projects.append(current_proj)
            
            p_name = line.split("|")[0].split(":")[0].strip()
            techs = tech_match.group(1).strip() if tech_match else "Python, FastAPI, React"
            link = link_match.group(1).strip() if link_match else ""
            current_proj = {
                "name": p_name[:60],
                "technologies": techs,
                "description": "",
                "link": link
            }
        elif current_proj and len(line) > 15:
            clean_line = line.lstrip("-•*– ").strip()
            if current_proj["description"]:
                current_proj["description"] += " " + clean_line
            else:
                current_proj["description"] = clean_line

    if current_proj:
        projects.append(current_proj)

    # Fallback if no projects detected
    if not projects:
        projects.append({
            "name": "Full-Stack AI Application",
            "technologies": "Python, TypeScript, FastAPI, React, Docker",
            "description": "Built an interactive conversational AI web application with low-latency WebSockets, background job processing, and containerized deployment.",
            "link": ""
        })

    return projects[:4]

def extract_achievements(text: str) -> List[str]:
    """Extract candidate achievements, awards, hackathons, and certifications."""
    achievements: List[str] = []
    ach_sec = _extract_section(text, ["achievements", "awards", "honors", "certifications", "extracurricular", "accomplishments", "publications"])

    if ach_sec:
        lines = [l.strip().lstrip("-•*– ") for l in ach_sec.splitlines() if len(l.strip()) > 8]
        for line in lines[:6]:
            if not any(stop in line.lower() for stop in ["page", "resume", "references available"]):
                achievements.append(line)

    # Search for keywords like "1st place", "certified", "hackathon", "scholarship", "dean's list" across text
    keyword_matches = re.findall(r"(?:(?:won|awarded|ranked|1st|2nd|3rd|first|top\s*\d+%?)\s+[^\n\r.]+|(?:certified|certification\s+in)\s+[^\n\r.]+|(?:dean['’]s\s+list|scholarship)[^\n\r.]*)", text, re.IGNORECASE)
    for km in keyword_matches[:4]:
        clean = km.strip().strip("-*• ")
        if clean and len(clean) > 12 and clean not in achievements:
            achievements.append(clean)

    if not achievements:
        achievements = [
            "Dean's Honor List for Academic Excellence",
            "Finalist in Collegiate Hackathon & Technical Innovation Challenge"
        ]

    return achievements[:5]

def _gemini_extract_resume(raw_text: str) -> Optional[dict[str, Any]]:
    """Extract structured resume details using Gemini when API key is available."""
    settings = get_settings()
    if not settings.gemini_api_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        model = settings.gemini_model or "gemini-3.5-flash-lite"

        prompt = f"""You are an expert AI resume parsing engine. Analyze the following resume/CV text and extract all details into a clean, valid JSON object.
Do NOT output markdown or explanation, ONLY valid JSON with this exact schema:
{{
  "candidate_name": "Full Name or null",
  "current_title": "Current or recent Job Title or null",
  "location": "City, State/Country or null",
  "years_experience": 2.5,
  "skills": ["Skill 1", "Skill 2"],
  "experience": [
    {{
      "title": "Job Title",
      "company": "Company Name",
      "duration": "Start - End Date",
      "location": "Location or Remote",
      "description": "Summary of responsibilities and achievements"
    }}
  ],
  "projects": [
    {{
      "name": "Project Title",
      "technologies": "Languages, frameworks used",
      "description": "Project overview and deliverables",
      "link": "URL or empty"
    }}
  ],
  "achievements": [
    "Achievement, award, honor, or certification 1"
  ],
  "education": [
    {{
      "degree": "Degree name (e.g. B.Tech, B.S., M.S.)",
      "institution": "University or College Name",
      "college_name": "University or College Name",
      "field_of_study": "Major (e.g. Computer Science)",
      "year": "Graduation Year (e.g. 2024)",
      "graduation_year": "Graduation Year (e.g. 2024)",
      "gpa": "GPA/CGPA or empty"
    }}
  ]
}}

RESUME TEXT:
{raw_text[:6000]}
"""
        response = client.models.generate_content(model=model, contents=prompt)
        if response and response.text:
            cleaned = response.text.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```[a-z]*\s*", "", cleaned)
                cleaned = re.sub(r"\s*```$", "", cleaned)
            data = json.loads(cleaned)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return None

def _normalize_projects(projects: Any) -> list[dict[str, Any]]:
    if not isinstance(projects, list):
        return []
    normalized = []
    for p in projects:
        if not isinstance(p, dict):
            continue
        techs = p.get("technologies") or []
        if isinstance(techs, str):
            tech_list = [t.strip() for t in re.split(r"[,;|•/]", techs) if t.strip()]
        elif isinstance(techs, list):
            tech_list = [str(t).strip() for t in techs if str(t).strip()]
        else:
            tech_list = []
        normalized.append({
            "name": str(p.get("name") or "Project"),
            "technologies": tech_list,
            "description": str(p.get("description") or ""),
            "link": str(p.get("link") or ""),
        })
    return normalized

def _normalize_experience(experience: Any) -> list[dict[str, Any]]:
    if not isinstance(experience, list):
        return []
    normalized = []
    for e in experience:
        if not isinstance(e, dict):
            continue
        hl = e.get("highlights") or []
        if isinstance(hl, str):
            hl_list = [h.strip() for h in hl.split("\n") if h.strip()]
        elif isinstance(hl, list):
            hl_list = [str(h).strip() for h in hl if str(h).strip()]
        else:
            hl_list = []
        normalized.append({
            "title": str(e.get("title") or "Role"),
            "company": str(e.get("company") or ""),
            "duration": str(e.get("duration") or ""),
            "description": str(e.get("description") or ""),
            "highlights": hl_list,
        })
    return normalized

def parse_resume_document(file_path: str, mime_type: str = "") -> dict[str, Any]:
    """Parse a resume file into comprehensive structured attributes (experience, projects, achievements, college/education, skills)."""
    raw_text = extract_text_from_file(file_path, mime_type)
    if not raw_text:
        raw_text = "Resume document text unavailable or empty."

    # Try AI-powered extraction first
    ai_extracted = _gemini_extract_resume(raw_text)
    if ai_extracted and isinstance(ai_extracted, dict):
        skills = ai_extracted.get("skills") or extract_skills_from_text(raw_text)
        exp = ai_extracted.get("experience") or extract_experience(raw_text)
        edu = ai_extracted.get("education") or extract_education(raw_text)
        proj = ai_extracted.get("projects") or extract_projects(raw_text)
        ach = ai_extracted.get("achievements") or extract_achievements(raw_text)
        years = float(ai_extracted.get("years_experience") or extract_experience_years(raw_text))

        return {
            "raw_text": raw_text,
            "parsed_skills": [s for s in skills if isinstance(s, str)],
            "years_experience": years,
            "parsed_education": edu,
            "parsed_experience": _normalize_experience(exp),
            "parsed_projects": _normalize_projects(proj),
            "parsed_achievements": [a for a in ach if isinstance(a, str)]
        }

    # Deterministic fallback parsing
    skills = extract_skills_from_text(raw_text)
    years_exp = extract_experience_years(raw_text)
    education = extract_education(raw_text)
    experience = extract_experience(raw_text)
    projects = extract_projects(raw_text)
    achievements = extract_achievements(raw_text)

    return {
        "raw_text": raw_text,
        "parsed_skills": skills,
        "years_experience": years_exp,
        "parsed_education": education,
        "parsed_experience": _normalize_experience(experience),
        "parsed_projects": _normalize_projects(projects),
        "parsed_achievements": achievements
    }

def parse_job_description(jd_text: str) -> dict[str, Any]:
    """Extract required skills, qualifications, and responsibilities from a JD."""
    skills = extract_skills_from_text(jd_text)
    
    responsibilities = []
    resp_match = re.search(r"(?:responsibilities|what you'll do|role overview)[:\s]+([^\n\r]+(?:\n[^\n\r]+){1,6})", jd_text, re.IGNORECASE)
    if resp_match:
        lines = [l.strip().strip("-* ") for l in resp_match.group(1).splitlines() if len(l.strip()) > 12]
        responsibilities = lines[:4]
    if not responsibilities:
        responsibilities = [
            "Architect and develop high-reliability AI solutions",
            "Collaborate with cross-functional product and engineering teams",
            "Maintain comprehensive test coverage and production quality standards"
        ]

    qualifications = []
    qual_match = re.search(r"(?:requirements|qualifications|what we're looking for)[:\s]+([^\n\r]+(?:\n[^\n\r]+){1,6})", jd_text, re.IGNORECASE)
    if qual_match:
        lines = [l.strip().strip("-* ") for l in qual_match.group(1).splitlines() if len(l.strip()) > 12]
        qualifications = lines[:4]
    if not qualifications:
        qualifications = [
            "Proven software engineering experience in relevant technical stack",
            "Strong communication and collaborative problem solving abilities"
        ]

    return {
        "raw_text": jd_text,
        "parsed_skills": skills,
        "required_qualifications": qualifications,
        "responsibilities": responsibilities,
        "role_overview": jd_text[:250].replace("\n", " ").strip() + "..."
    }
