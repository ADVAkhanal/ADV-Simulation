import ModeDock from "./mode-dock";

export default function Template({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><ModeDock />{children}</>;
}
