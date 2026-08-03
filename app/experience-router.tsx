"use client";

import { useEffect, useState } from "react";
import ManualCampaign from "./manual-campaign";

export default function ExperienceRouter({ children }: Readonly<{ children: React.ReactNode }>) {
  const [path, setPath] = useState("");

  useEffect(() => setPath(window.location.pathname), []);

  if (path === "/") return <ManualCampaign />;
  return children;
}
