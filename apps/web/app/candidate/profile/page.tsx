"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Award,
  Briefcase,
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderGit2,
  GraduationCap,
  MapPin,
  Save,
  Sparkles,
  Upload,
  User,
} from "lucide-react";
import { candidateFetch, getCandidateUser, setCandidateUser } from "@/lib/candidate-client";

export default function CandidateProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Photo upload states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Resume upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const [userData, resumeData] = await Promise.all([
          candidateFetch<any>("/api/candidate/auth/me"),
          candidateFetch<any>("/api/candidate/resume"),
        ]);

        setUser(userData);
        setFullName(userData.full_name || "");
        setCurrentTitle(userData.current_title || "");
        setPhone(userData.phone || "");
        setLocation(userData.location || "");
        setHeadline(userData.headline || "");
        setBio(userData.bio || "");

        setResume(resumeData);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    try {
      const updated = await candidateFetch<any>("/api/candidate/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName,
          current_title: currentTitle,
          phone,
          location,
          headline,
          bio,
        }),
      });
      setUser(updated);
      setCandidateUser(updated);
      setProfileSuccess("Profile updated successfully!");
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleResumeUpload(e: React.FormEvent) {
    e.preventDefault();
    setUploadingResume(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      if (uploadFile) {
        formData.append("file", uploadFile);
      } else if (pastedText.trim().length > 20) {
        formData.append("pasted_text", pastedText.trim());
      } else {
        throw new Error("Please select a resume file (PDF/DOCX/TXT) or paste text.");
      }

      const res = await candidateFetch<any>("/api/candidate/resume/upload", {
        method: "POST",
        body: formData,
      });

      setResume(res);
      setUploadSuccess(`Resume uploaded & parsed! Found ${res.parsed_skills?.length || 0} skills.`);
      setUploadFile(null);
      setPastedText("");
    } catch (err: any) {
      setUploadError(err.message || "Failed to process resume.");
    } finally {
      setUploadingResume(false);
    }
  }

  function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setPhotoError("Photo size must be less than 5MB.");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
      setPhotoError(null);
      setPhotoSuccess(null);
    }
  }

  async function handlePhotoUpload(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!photoFile) return;

    setUploadingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      const formData = new FormData();
      formData.append("photo", photoFile);

      const res = await candidateFetch<any>("/api/candidate/photo/upload", {
        method: "POST",
        body: formData,
      });

      setUser((prev: any) => ({ ...prev, avatar_url: res.avatar_url }));
      const currentUser = getCandidateUser();
      if (currentUser) {
        setCandidateUser({ ...currentUser, avatar_url: res.avatar_url });
      }
      setPhotoSuccess("Student photo updated successfully!");
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (err: any) {
      setPhotoError(err.message || "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Resume & Candidate Profile</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Upload and manage your resume document, verify extracted skills, and customize your profile.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Information Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <User size={18} className="text-blue-400" />
              Candidate Profile Details
            </h2>

            {profileSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Professional Title</label>
                  <input
                    type="text"
                    value={currentTitle}
                    onChange={(e) => setCurrentTitle(e.target.value)}
                    placeholder="e.g. Lead AI Systems Engineer"
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="San Francisco, CA or Remote"
                    className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Short tagline (e.g. Real-Time WebRTC and LLM Systems Architect)"
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Bio / Overview</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Summary of engineering focus, architectures, and career achievements..."
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Save size={14} />
                {savingProfile ? "Saving Profile..." : "Save Profile Details"}
              </button>
            </form>
          </div>

          {/* Active Parsed Resume Card */}
          <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#262b32] pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-purple-400" />
                Extracted Resume Competencies & Detailed Profile
              </h2>
              {resume && (
                <span className="text-[11px] text-zinc-400 bg-[#1c222b] px-2.5 py-1 rounded-full border border-[#2a303c]">
                  Parsed Resume Active
                </span>
              )}
            </div>

            {resume ? (
              <div className="space-y-6 text-xs">
                {/* 1. Discovered Skills */}
                <div>
                  <span className="text-zinc-300 font-semibold flex items-center gap-1.5 mb-2.5 text-xs">
                    <Sparkles size={14} className="text-blue-400" />
                    Discovered Skills ({resume.parsed_skills?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {resume.parsed_skills?.map((s: string) => (
                      <span key={s} className="rounded-md bg-blue-950/40 border border-blue-500/20 px-2.5 py-1 text-xs text-blue-300 font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. College & Education Info */}
                {resume.parsed_education?.length > 0 && (
                  <div>
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5 mb-2.5 text-xs">
                      <GraduationCap size={15} className="text-emerald-400" />
                      College & Education Information
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resume.parsed_education.map((edu: any, i: number) => (
                        <div key={i} className="bg-[#1c222b] p-3.5 rounded-xl border border-[#2a303c] space-y-1">
                          <p className="font-bold text-white text-sm">
                            {edu.degree || "Degree"}
                          </p>
                          <p className="text-zinc-300 font-medium">
                            {edu.institution || edu.college_name || "University / College"}
                          </p>
                          {edu.field_of_study && (
                            <p className="text-zinc-400 text-[11px]">Major: {edu.field_of_study}</p>
                          )}
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-400">
                            {(edu.graduation_year || edu.year) && (
                              <span>Graduation: <strong className="text-zinc-200">{edu.graduation_year || edu.year}</strong></span>
                            )}
                            {edu.gpa && (
                              <span>GPA: <strong className="text-emerald-400">{edu.gpa}</strong></span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Prior Work Experience */}
                {resume.parsed_experience?.length > 0 && (
                  <div>
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5 mb-2.5 text-xs">
                      <Briefcase size={15} className="text-indigo-400" />
                      Prior Work Experience
                    </span>
                    <div className="space-y-3">
                      {resume.parsed_experience.map((exp: any, i: number) => (
                        <div key={i} className="bg-[#1c222b] p-3.5 rounded-xl border border-[#2a303c] space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-bold text-white text-sm">
                              {exp.title || "Software Engineer"}
                            </p>
                            {exp.duration && (
                              <span className="text-[11px] text-zinc-400 font-medium bg-[#161a22] px-2 py-0.5 rounded border border-[#2a303c]">
                                {exp.duration}
                              </span>
                            )}
                          </div>
                          {exp.company && (
                            <p className="text-indigo-300 font-medium text-xs">{exp.company}</p>
                          )}
                          {exp.description && (
                            <p className="text-zinc-300 text-xs leading-relaxed">{exp.description}</p>
                          )}
                          {(() => {
                            const hlList = Array.isArray(exp.highlights)
                              ? exp.highlights
                              : typeof exp.highlights === "string"
                              ? exp.highlights.split(/\n+/).map((h: string) => h.trim()).filter(Boolean)
                              : [];
                            return hlList.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px] pt-1">
                                {hlList.map((h: string, idx: number) => (
                                  <li key={idx}>{h}</li>
                                ))}
                              </ul>
                            ) : null;
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Projects */}
                {resume.parsed_projects?.length > 0 && (
                  <div>
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5 mb-2.5 text-xs">
                      <FolderGit2 size={15} className="text-amber-400" />
                      Featured Projects
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {resume.parsed_projects.map((proj: any, i: number) => {
                        const techList = Array.isArray(proj.technologies)
                          ? proj.technologies
                          : typeof proj.technologies === "string"
                          ? proj.technologies.split(/[,;|•/]/).map((t: string) => t.trim()).filter(Boolean)
                          : [];
                        return (
                          <div key={i} className="bg-[#1c222b] p-3.5 rounded-xl border border-[#2a303c] flex flex-col justify-between space-y-2">
                            <div>
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-white text-sm">{proj.name || "Project"}</p>
                                {proj.link && (
                                  <a
                                    href={proj.link.startsWith("http") ? proj.link : `https://${proj.link}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 text-[11px]"
                                  >
                                    Link <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                              {proj.description && (
                                <p className="text-zinc-300 text-xs mt-1 leading-relaxed">{proj.description}</p>
                              )}
                            </div>
                            {techList.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {techList.map((t: string) => (
                                  <span key={t} className="rounded bg-[#161a22] border border-[#2a303c] px-1.5 py-0.5 text-[10px] text-zinc-300">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Achievements & Certifications */}
                {resume.parsed_achievements?.length > 0 && (
                  <div>
                    <span className="text-zinc-300 font-semibold flex items-center gap-1.5 mb-2.5 text-xs">
                      <Award size={15} className="text-purple-400" />
                      Achievements, Awards & Certifications
                    </span>
                    <div className="space-y-1.5">
                      {resume.parsed_achievements.map((ach: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 bg-[#1c222b] p-2.5 rounded-lg border border-[#2a303c] text-zinc-300">
                          <Award size={14} className="text-purple-400 mt-0.5 flex-shrink-0" />
                          <span className="leading-snug">{ach}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No parsed resume on file. Upload your resume on the right to start.</p>
            )}
          </div>
        </div>

        {/* Right Column: Student Photo & Resume Uploaders */}
        <div className="space-y-6">
          {/* Student Photo Uploader */}
          <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Camera size={18} className="text-indigo-400" />
              Student / Candidate Photo
            </h2>
            <p className="text-xs text-zinc-400">
              Upload your professional photo (JPG, PNG, or WEBP up to 5MB). Visible to recruiters on your profile and applications.
            </p>

            {photoSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{photoSuccess}</span>
              </div>
            )}

            {photoError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{photoError}</span>
              </div>
            )}

            <div className="flex flex-col items-center justify-center p-4 bg-[#1a1f26] rounded-xl border border-[#2a303c] space-y-3">
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-24 w-24 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                  />
                  <span className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    New
                  </span>
                </div>
              ) : user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name || "Student"}
                  className="h-24 w-24 rounded-full object-cover border-2 border-indigo-500/50 shadow-md"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-2xl font-bold text-white shadow-md">
                  {(user?.full_name || "S")[0]}
                </div>
              )}

              <div className="w-full space-y-2">
                <input
                  type="file"
                  id="student-photo-file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="student-photo-file"
                  className="cursor-pointer block text-center rounded-lg border border-[#2d3644] hover:border-indigo-500/50 bg-[#14181f] py-2 px-3 text-xs font-semibold text-zinc-200 transition-colors"
                >
                  {photoFile ? photoFile.name : "Select Image File"}
                </label>

                {photoFile && (
                  <button
                    type="button"
                    onClick={() => handlePhotoUpload()}
                    disabled={uploadingPhoto}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 px-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Upload size={13} />
                    {uploadingPhoto ? "Uploading..." : "Save Profile Photo"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Resume Uploader */}
          <div className="rounded-2xl border border-[#262b32] bg-[#161a22] p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload size={18} className="text-blue-400" />
              Upload Resume Document
            </h2>
            <p className="text-xs text-zinc-400">
              Supported formats: PDF, DOCX, TXT (up to 10MB). Automatically parsed into structured skills, college education, experience, projects, and achievements.
            </p>

            {uploadSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {uploadError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleResumeUpload} className="space-y-4">
              <div className="rounded-xl border-2 border-dashed border-[#2d3644] hover:border-blue-500/50 p-6 text-center transition-colors">
                <input
                  type="file"
                  id="resume-file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="resume-file" className="cursor-pointer block space-y-2">
                  <FileText className="mx-auto h-8 w-8 text-blue-400" />
                  <p className="text-xs font-semibold text-white">
                    {uploadFile ? uploadFile.name : "Click to select PDF or DOCX resume"}
                  </p>
                  <p className="text-[11px] text-zinc-500">Max size 10MB</p>
                </label>
              </div>

              <div className="text-center text-xs text-zinc-500">— or paste resume text —</div>

              <div>
                <textarea
                  rows={4}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste raw resume or CV text here..."
                  className="w-full rounded-lg border border-[#2a303c] bg-[#1a1f26] px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={uploadingResume || (!uploadFile && !pastedText.trim())}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-all shadow-md shadow-blue-600/20"
              >
                <Upload size={14} />
                {uploadingResume ? "Parsing Document..." : "Parse & Update Resume"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
