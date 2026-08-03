import ExperienceRouter from "./experience-router";
import ModeDock from "./mode-dock";

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><ExperienceRouter>{children}</ExperienceRouter><ModeDock /></>;
}
