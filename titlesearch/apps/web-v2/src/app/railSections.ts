import React from "react";
import { doorTitle, type Door } from "../entities/nav/doors";
import type { LifecycleStage } from "../entities/nav/LifecycleRail";
import type { SidebarDoorItem, SidebarSection } from "../entities/nav/Sidebar";
import type { Attention } from "./attention";
import {
  LayoutGrid,
  LineChart,
  AlertCircle,
  Upload,
  HelpCircle,
  Settings,
  CheckCircle2,
  Send,
  ShieldCheck,
  FileText,
  Users,
  UserCircle,
  ListTodo,
  MapPin,
  User
} from "lucide-react";

function getIconForPath(path: string) {
  if (path.startsWith("/queue")) return React.createElement(LayoutGrid);
  if (path.startsWith("/overview")) return React.createElement(LineChart);
  if (path.startsWith("/escalations")) return React.createElement(AlertCircle);
  if (path.startsWith("/ingest")) return React.createElement(Upload);
  if (path.startsWith("/questions")) return React.createElement(HelpCircle);
  if (path.startsWith("/processing")) return React.createElement(Settings);
  if (path.startsWith("/completeness")) return React.createElement(CheckCircle2);
  if (path.startsWith("/delivered")) return React.createElement(Send);
  if (path.startsWith("/rulebook")) return React.createElement(ShieldCheck);
  if (path.startsWith("/products")) return React.createElement(FileText);
  if (path.startsWith("/clients")) return React.createElement(Users);
  if (path.startsWith("/people")) return React.createElement(UserCircle);
  if (path.startsWith("/audit")) return React.createElement(ListTodo);
  if (path.startsWith("/profile")) return React.createElement(User);
  if (path.startsWith("/gallery")) return React.createElement(MapPin);
  return React.createElement(LayoutGrid);
}

export interface RailInputs {
  doors: readonly Door[];
  lifecycle: readonly LifecycleStage[];
  flowLabel: string;
  orderRef: string | null;
  isActive: (to: string) => boolean;
  attentionFor: (path: string) => Attention;
}

export function railSections({
  doors,
  lifecycle,
  flowLabel,
  orderRef,
  isActive,
  attentionFor,
}: RailInputs): SidebarSection[] {
  const toItem = (door: Door): SidebarDoorItem => ({
    to: door.path,
    label: door.label,
    icon: getIconForPath(door.path),
    title: doorTitle(door),
    active: isActive(door.path),
    attention: attentionFor(door.path),
  });
  
  const group = (name: Door["group"]) => doors.filter((d) => d.group === name).map(toItem);

  const sections: SidebarSection[] = [];
  const work = group("work");
  if (work.length > 0) sections.push({ kind: "doors", label: "WORK", doors: work });

  if (lifecycle.length > 0) {
    const flowDoors: SidebarDoorItem[] = lifecycle.map((stage) => ({
      to: stage.to,
      label: stage.label,
      icon: getIconForPath(stage.to),
      title: stage.label,
      active: stage.active,
      attention: stage.attention
    }));

    sections.push({
      kind: "doors",
      label: flowLabel,
      ...(orderRef === null ? {} : { note: orderRef }),
      doors: flowDoors,
    });
  }

  const admin = group("admin");
  if (admin.length > 0) sections.push({ kind: "doors", label: "ADMIN", doors: admin });

  const reference = group("reference");
  if (reference.length > 0) {
    sections.push({
      kind: "doors",
      label: "REFERENCE",
      doors: reference,
    });
  }
  return sections;
}
