import React from "react";
import { useManifest } from "@/context/ManifestContext";
import { User, Phone, Calendar } from "lucide-react";

const CareTeamSection: React.FC = () => {
  const { manifest } = useManifest();
  const ct = manifest.careTeam;

  if (!ct) return null;

  const members = [ct.physician, ct.coach].filter(Boolean);

  return (
    <section className="animate-fade-in space-y-8">
      <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
        Care Team
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {members.map((member, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="font-sans font-semibold text-foreground text-sm">{member.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
            {member.specialty && <p className="text-xs text-muted-foreground mb-1">{member.specialty}</p>}
            {member.contact && (
              <div className="flex items-center gap-1 text-xs text-secondary mt-2">
                <Phone className="h-3 w-3" /> {member.contact}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Appointments */}
      {ct.appointments?.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-foreground flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-secondary" /> Upcoming
          </h3>
          <div className="space-y-3">
            {ct.appointments.map((appt, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex-1">
                  <p className="font-sans font-medium text-foreground text-sm">{appt.type}</p>
                  <p className="text-xs text-muted-foreground">{appt.provider}</p>
                </div>
                <span className="text-xs bg-navy-light text-primary rounded-full px-2.5 py-0.5 self-start">{appt.date}</span>
                {appt.notes && <p className="text-xs text-muted-foreground italic sm:hidden">{appt.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default CareTeamSection;
