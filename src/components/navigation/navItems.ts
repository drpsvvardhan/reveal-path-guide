import React from "react";
import {
  Map, Activity, Scale, Brain, RefreshCw,
  ListChecks, MessageCircle, ShieldCheck, GitBranch, Users, FolderOpen, MessageSquare, Sparkles, Layers, FlaskConical, Dna, Home
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  /**
   * "primary" items are always visible. "explore" items live behind the
   * collapsed "Explore my Twin" group — hidden, not deleted. The beta
   * question is what patients naturally ask, not whether they can navigate
   * every panel.
   */
  group: "primary" | "explore";
}

export const navItems: NavItem[] = [
  { id: "home", label: "Ask My Twin", shortLabel: "Home", icon: Home, group: "primary" },
  { id: "queue", label: "Questions for my doctor", shortLabel: "Questions", icon: MessageSquare, group: "primary" },
  { id: "biotwin", label: "Your BioTwin", shortLabel: "BioTwin", icon: Dna, group: "primary" },
  { id: "records", label: "Medical Records", shortLabel: "Records", icon: FolderOpen, group: "primary" },

  { id: "ask", label: "Ask anything", shortLabel: "Ask", icon: MessageCircle, group: "explore" },
  { id: "journey", label: "Journey", shortLabel: "Journey", icon: Map, group: "explore" },
  { id: "thesis", label: "What's happening in your body", shortLabel: "Body", icon: Activity, group: "explore" },
  { id: "helping-feeding", label: "What is helping — and what is still feeding the problem", shortLabel: "Factors", icon: Scale, group: "explore" },
  { id: "noticed", label: "What we've noticed", shortLabel: "Noticed", icon: Sparkles, group: "explore" },
  { id: "terrain", label: "Your terrain", shortLabel: "Terrain", icon: Layers, group: "explore" },
  { id: "reversibility", label: "What can still change", shortLabel: "Change", icon: RefreshCw, group: "explore" },
  { id: "actions", label: "What to do", shortLabel: "Actions", icon: ListChecks, group: "explore" },
  { id: "simulator", label: "Biological Simulator", shortLabel: "Simulate", icon: FlaskConical, group: "explore" },
  { id: "confidence", label: "How sure are we", shortLabel: "Certainty", icon: ShieldCheck, group: "explore" },
  { id: "care-map", label: "Care Map", shortLabel: "Map", icon: GitBranch, group: "explore" },
  { id: "care-team", label: "Care Team", shortLabel: "Team", icon: Users, group: "explore" },
];
