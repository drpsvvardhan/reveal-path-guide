import React from "react";
import {
  Map, Activity, Scale, Brain, RefreshCw,
  ListChecks, MessageCircle, ShieldCheck, GitBranch, Users, FolderOpen, MessageSquare, Sparkles
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

export const navItems: NavItem[] = [
  { id: "journey", label: "Journey", shortLabel: "Journey", icon: Map },
  { id: "thesis", label: "What's happening in your body", shortLabel: "Body", icon: Activity },
  { id: "helping-feeding", label: "What is helping — and what is still feeding the problem", shortLabel: "Factors", icon: Scale },
  { id: "symptoms", label: "Why you might be feeling this way", shortLabel: "Symptoms", icon: Brain },
  { id: "noticed", label: "What we've noticed", shortLabel: "Noticed", icon: Sparkles },
  { id: "reversibility", label: "What can still change", shortLabel: "Change", icon: RefreshCw },
  { id: "actions", label: "What to do", shortLabel: "Actions", icon: ListChecks },
  { id: "records", label: "Medical Records", shortLabel: "Records", icon: FolderOpen },
  { id: "ask", label: "Ask anything", shortLabel: "Ask", icon: MessageCircle },
  { id: "queue", label: "My questions", shortLabel: "Questions", icon: MessageSquare },
  { id: "confidence", label: "How sure are we", shortLabel: "Certainty", icon: ShieldCheck },
  { id: "care-map", label: "Care Map", shortLabel: "Map", icon: GitBranch },
  { id: "care-team", label: "Care Team", shortLabel: "Team", icon: Users },
];
