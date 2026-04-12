import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { User, Phone, Calendar, MessageCircle, Video, Eye } from "lucide-react";
import PatientSectionLayout from "@/components/layout/PatientSectionLayout";
import AsideInfoPanel from "@/components/layout/AsideInfoPanel";
import ClinicalHandoffPanel from "@/components/terrain/ClinicalHandoffPanel";

const CareTeamSection: React.FC = () => {
  const { manifest } = useManifest();
  const ct = manifest.careTeam;

  if (!ct) return null;

  const members = [ct.physician, ct.coach].filter(Boolean);

  return (
    <PatientSectionLayout
      eyebrow="CARE TEAM"
      title="The people watching with you"
      intro="Your providers, what each of them is watching, and how to reach them."
      aside={
        <AsideInfoPanel
          title="Team summary"
          items={[
            { label: "Primary physician", value: ct.physician?.name || "—" },
            { label: "Care coach", value: ct.coach?.name || "—" },
            { label: "Next call", value: "In 5 days", tone: "accent" },
          ]}
        />
      }
    >
      <ClinicalHandoffPanel />

      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((member, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-lavender-light flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-sans font-semibold text-foreground text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
            {member.specialty && <p className="text-xs text-muted-foreground">{member.specialty}</p>}
            {member.watching && (
              <div className="rounded-lg bg-lavender-light p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye className="h-3 w-3 text-primary" />
                  <p className="text-[10px] font-sans font-semibold uppercase tracking-wider text-primary">Watching</p>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">{member.watching}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-sans font-medium text-foreground hover:bg-muted transition-colors">
                <MessageCircle className="h-3.5 w-3.5 text-primary" />Message
              </button>
              {member.contact?.includes("call") && (
                <button className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-sans font-medium text-foreground hover:bg-muted transition-colors">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-sky-light flex items-center justify-center shrink-0">
          <Video className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-sans font-medium text-foreground text-sm">Telemedicine</p>
          <p className="text-xs text-muted-foreground">Video consultations available for follow-up appointments</p>
        </div>
      </div>

      {ct.appointments?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-primary" /> Upcoming
          </h3>
          <div className="space-y-3">
            {ct.appointments.map((appt, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1">
                  <p className="font-sans font-medium text-foreground text-sm">{appt.type}</p>
                  <p className="text-xs text-muted-foreground">{appt.provider}</p>
                </div>
                <span className="text-xs bg-lavender-light text-primary rounded-full px-2.5 py-0.5 self-start">{appt.date}</span>
                {appt.notes && <p className="text-xs text-muted-foreground italic sm:hidden">{appt.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </PatientSectionLayout>
  );
};

export default CareTeamSection;
