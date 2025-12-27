import type { ReactNode } from "react";

export interface NavigationLink {
  href: string;
  label: string;
  iconPath: ReactNode;
}

export interface DividerItem {
  isDivider: true;
}

export type NavigationItem = NavigationLink | DividerItem;

