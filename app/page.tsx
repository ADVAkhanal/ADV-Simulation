"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { animate, stagger } from "animejs";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, FileCheck2, Gauge, Menu, ShieldCheck, Sparkles, X } from "lucide-react";

const pillars = [
  { index: "01", eyebrow: "Integrated model", title: "One partner from stock to inspected assembly.", body: "Machining, fabrication, engineered plastics, assembly and quality systems live inside one operating story—reducing handoffs before they become schedule risk.", signal: "6 connected capabilities" },
  { index: "02", eyebrow: "Automation", title: "Capacity designed to compound, not just expand.", body: "Palletized workflows and an FMS robotic Fastems system create the foundation for repeatable production across complex, high-mix programs.", signal: "FMS-enabled production" },
  { index: "03", eyebrow: "Quality moat", title: "Evidence travels with the part.", body: "AS9100 and ISO 9001 systems, first-article discipline, in-process control and CMM verification make quality visible from print review to release.", signal: "Dual-certified QMS" },
];

const capabilityData = [
  { id: "machining", label: "Precision machining", kicker: "3 / 4 / 5-axis", title: "Complex geometry. Controlled execution.", body: "Multi-axis machining, mill-turn capability and palletized production for demanding metals and engineered plastics.", facts: ["Aluminum, titanium, nickel alloys and CRES", "FMS robotic Fastems system", "Prototype and production programs"], bars: [92, 83, 74, 88], axes: ["Multi-axis", "Automation", "Material range", "Inspection path"], image: "/work-longeron.jpg" },
  { id: "plastics", label: "Engineered plastics", kicker: "Stock + machine", title: "Material intelligence under one roof.", body: "Distribution, selection support and precision conversion across high-performance, engineered and general-industrial polymers.", facts: ["Rod, sheet, tube and film", "Thermoset, thermoplastic and elastomeric", "FDA- and NSF-compliant grades when specified"], bars: [84, 91, 77, 68], axes: ["Stock depth", "Material range", "Conversion", "Compliance"], image: "/work-door-hinge.jpg" },
  { id: "quality", label: "Quality systems", kicker: "AS9100 + ISO 9001", title: "A release path you can audit.", body: "Requirements review, first-article inspection, in-process control and dimensional verification built into the production route.", facts: ["Zeiss and DuraMax CMM equipment", "Program-specific traceability", "Controlled final release and records"], bars: [94, 87, 91, 85], axes: ["QMS", "Metrology", "Traceability", "Release control"], image: "/work-motorlead.jpeg" },
];

const projects = [
  { image: "/work-longeron.jpg", type: "Aerospace", title: "Upper-door longeron assembly", meta: "7050-T7451 aluminum · 5-axis mill", size: "2.50 × 11.93 × 25.25 in" },
  { image: "/work-door-hinge.jpg", type: "Aerospace", title: "Main landing-gear door hinge", meta: "6AL-4V titanium · 4-axis horizontal", size: "3.00 × 5.50 × 14.00 in" },
  { image: "/work-motorlead.jpeg", type: "Energy", title: "Motor-lead housing", meta: "K-500 Monel · 5-axis multi-task", size: "Ø 3.50 × 4.00 in" },
];

const diligenceRows = [
  ["Company heritage", "Founded 1979 in Owasso, Oklahoma", "Verified"],
  ["Operating footprint", "Three equipped shops onsite", "Verified"],
  ["Quality systems", "AS9100 and ISO 9001 certified QMS", "Verified"],
  ["Workforce", "50+ manufacturing professionals", "Verified"],
  ["Performance data", "OTD, scrap, utilization and backlog trend", "Request"],
  ["Commercial mix", "Customer concentration and program tenure", "Request"],
];

function SectionTag({ index, children, light = false }: { index: string; children: React.ReactNode; light?: boolean }) {
  return <div className={"section-tag " + (light ? "is-light" : "")}><span>{index}</span><p>{children}</p></div>;
}
function SlideButton({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return <a className={"slide-button " + (dark ? "is-dark" : "")} href={href}><span className="slide-button-copy"><i>{children}</i><i aria-hidden="true">{children}</i></span><ArrowUpRight size={15} strokeWidth={1.8} /></a>;
}
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-8%" }} transition={{ duration: .75, delay, ease: [.16, 1, .3, 1] }}>{children}</motion.div>;
}
function EvidenceChart({ values, labels }: { values: number[]; labels: string[] }) {
  return <div className="evidence-chart" aria-label="Capability evidence profile">
    <div className="chart-scale"><span>Evidence profile</span><span>High</span></div>
    <div className="chart-grid" aria-hidden="true"><i /><i /><i /><i /></div>
    <div className="chart-bars">{values.map((value, index) => <div className="chart-column" key={labels[index]}><motion.i initial={{ height: 0 }} whileInView={{ height: value + "%" }} viewport={{ once: true }} transition={{ duration: .9, delay: index * .08, ease: [.16, 1, .3, 1] }} /><span>{labels[index]}</span></div>)}</div>
    <p>Directional visualization of publicly supported capability breadth—not a financial or performance score.</p>
  </div>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCapability, setActiveCapability] = useState("machining");
  const heroRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 32, restDelta: .001 });
  const active = useMemo(() => capabilityData.find((item) => item.id === activeCapability) ?? capabilityData[0], [activeCapability]);

  useEffect(() => {
    if (reduced || !heroRef.current) return;
    const root = heroRef.current;
    animate(root.querySelectorAll("[data-intro]"), { opacity: { from: 0 }, y: { from: "2.5rem" }, duration: 1050, delay: stagger(85), ease: "outExpo" });
    animate(root.querySelectorAll(".orbit-dot"), { rotate: "1turn", duration: 18000, loop: true, ease: "linear" });
  }, [reduced]);

  return <main>
    <motion.div className="page-progress" style={{ scaleX }} />
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#top" aria-label="Advanced home"><span>ADV</span><b>ANCED</b><small>Precision manufacturing</small></a>
      <nav className="desktop-nav" aria-label="Primary navigation"><a href="#thesis">Why Advanced</a><a href="#capabilities">Capabilities</a><a href="#evidence">Evidence</a><a href="#quality">Quality</a></nav>
      <div className="header-status"><i /> Owasso, OK · Since 1979</div>
      <SlideButton href="https://advcosinc.com/quote/" dark>Start an RFQ</SlideButton>
      <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation"><a onClick={() => setMenuOpen(false)} href="#thesis">Why Advanced</a><a onClick={() => setMenuOpen(false)} href="#capabilities">Capabilities</a><a onClick={() => setMenuOpen(false)} href="#evidence">Evidence</a><a onClick={() => setMenuOpen(false)} href="#quality">Quality</a><a href="https://advcosinc.com/quote/">Start an RFQ ↗</a></nav>}
    </header>

    <section className="hero" id="top" ref={heroRef}>
      <div className="hero-media"><img src="/work-longeron.jpg" alt="Precision-machined aerospace longeron produced by Advanced" /><div className="hero-shade" /></div>
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orbit" aria-hidden="true"><div className="orbit-dot"><i /></div><span>05 AXIS</span></div>
      <div className="hero-main" id="main-content">
        <div className="hero-kicker" data-intro><span>ADV / 001</span><p>Precision manufacturing for high-consequence programs</p></div>
        <h1 data-intro>Built for the parts<br />that <em>cannot fail.</em></h1>
        <div className="hero-support" data-intro><p>Advanced unifies complex machining, engineered plastics, assembly and inspection into one controlled production path.</p><div><SlideButton href="https://advcosinc.com/quote/">Bring us the drawing</SlideButton><a className="text-link" href="#thesis">Explore the operating story <ArrowDownRight size={15} /></a></div></div>
      </div>
      <aside className="command-card" data-intro>
        <div className="command-head"><span><Sparkles size={13} /> Advanced signal desk</span><b>Live profile</b></div>
        <div className="command-score"><div><span>Operating confidence</span><strong>04</strong><small>publicly verified signals</small></div><div className="score-ring"><i>4/4</i></div></div>
        <div className="signal-list"><p><Check size={13} /> 45+ years of operating history</p><p><Check size={13} /> AS9100 + ISO 9001 systems</p><p><Check size={13} /> Multi-axis + FMS automation</p><p><Check size={13} /> Metals + plastics platform</p></div>
        <a href="#evidence">Open evidence room <ChevronRight size={14} /></a>
      </aside>
      <div className="hero-metrics" data-intro><div><strong>1979</strong><span>Founded in Oklahoma</span></div><div><strong>3</strong><span>Equipped shops onsite</span></div><div><strong>50+</strong><span>Manufacturing professionals</span></div><div><strong>2</strong><span>Certified quality systems</span></div></div>
    </section>

    <section className="marquee" aria-label="Industries served"><div><span>Aerospace</span><i>✦</i><span>Defense</span><i>✦</i><span>Energy</span><i>✦</i><span>Food processing</span><i>✦</i><span>Industrial OEM</span><i>✦</i><span>Aerospace</span><i>✦</i><span>Defense</span><i>✦</i></div></section>

    <section className="thesis section-shell" id="thesis">
      <div className="section-intro"><SectionTag index="01">Why Advanced</SectionTag><Reveal><h2>A manufacturing platform,<br />not a <em>machine list.</em></h2></Reveal><Reveal delay={.08}><p>The strongest manufacturing partners convert complexity into control. Advanced connects technical review, material knowledge, production systems and inspection evidence around the part in front of us.</p></Reveal></div>
      <div className="pillar-grid">{pillars.map((pillar, index) => <Reveal key={pillar.index} delay={index * .08} className="pillar-card"><div className="pillar-top"><span>{pillar.index}</span><Gauge size={19} strokeWidth={1.5} /></div><p className="eyebrow">{pillar.eyebrow}</p><h3>{pillar.title}</h3><p>{pillar.body}</p><div className="pillar-signal"><i /><span>{pillar.signal}</span></div></Reveal>)}</div>
    </section>

    <section className="operating-system" id="capabilities">
      <div className="operating-copy"><SectionTag index="02" light>Operating system</SectionTag><Reveal><h2>Capability,<br />mapped.</h2></Reveal><Reveal><p>Move through the operating model to see how each capability contributes to a controlled manufacturing path.</p></Reveal><div className="capability-tabs" role="tablist" aria-label="Capabilities">{capabilityData.map((item, index) => <button key={item.id} role="tab" aria-selected={active.id === item.id} onClick={() => setActiveCapability(item.id)}><span>0{index + 1}</span><b>{item.label}</b><ChevronRight size={16} /></button>)}</div></div>
      <motion.div className="capability-stage" key={active.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .35 }}>
        <div className="capability-image"><img src={active.image} alt="" /><span>{active.kicker}</span></div>
        <div className="capability-info"><p className="eyebrow">{active.kicker}</p><h3>{active.title}</h3><p>{active.body}</p><ul>{active.facts.map((fact) => <li key={fact}><Check size={14} />{fact}</li>)}</ul><EvidenceChart values={active.bars} labels={active.axes} /></div>
      </motion.div>
    </section>

    <section className="work section-shell" id="work">
      <div className="work-head"><SectionTag index="03">Selected evidence</SectionTag><Reveal><h2>Specific parts.<br />Specific proof.</h2></Reveal><a href="https://advcosinc.com/gallery/">Full production gallery <ArrowUpRight size={15} /></a></div>
      <div className="work-grid">{projects.map((project, index) => <Reveal className={"work-card work-card-" + (index + 1)} key={project.title} delay={index * .08}><a href="https://advcosinc.com/gallery/" className="work-image"><img src={project.image} alt={project.title + " manufactured by Advanced"} /><div className="work-corners" /><span>0{index + 1}</span><b>View evidence <ArrowUpRight size={14} /></b></a><div className="work-meta"><p>{project.type}</p><span>{project.size}</span></div><h3>{project.title}</h3><p>{project.meta}</p></Reveal>)}</div>
    </section>

    <section className="quality" id="quality">
      <div className="quality-visual"><div className="metrology" aria-hidden="true"><span>Q</span><i /><i /><i /></div><div className="quality-caption"><span>Inspection datum</span><b>00.000</b></div></div>
      <div className="quality-copy"><SectionTag index="04" light>Quality moat</SectionTag><Reveal><h2>Proof lives<br />in the <em>system.</em></h2></Reveal><Reveal><p>Quality is not a final gate. It is the route—from requirements review and first article to in-process control, CMM verification and documented release.</p></Reveal><div className="cert-row"><div><ShieldCheck /><strong>AS9100</strong><span>Aerospace QMS</span></div><div><FileCheck2 /><strong>ISO 9001</strong><span>Quality management</span></div></div><ol>{["Requirement review", "First-article inspection", "In-process control", "CMM verification", "Final release + records"].map((step, index) => <li key={step}><span>0{index + 1}</span><b>{step}</b><i>{index < 4 ? "→" : "✓"}</i></li>)}</ol></div>
    </section>

    <section className="evidence section-shell" id="evidence">
      <div className="evidence-head"><SectionTag index="05">Evidence room</SectionTag><Reveal><h2>Clarity creates<br /><em>confidence.</em></h2></Reveal><Reveal><p>Every public claim is labeled. Sensitive operating metrics stay inside the controlled diligence or quote process.</p></Reveal></div>
      <div className="evidence-console">
        <div className="console-bar"><span><i /> advanced / evidence-room</span><div><b /><b /><b /></div></div>
        <div className="console-summary"><div><small>Public profile</small><strong>4 verified</strong></div><div><small>Priority diligence</small><strong>2 requests</strong></div><div><small>Disclosure policy</small><strong>Controlled</strong></div></div>
        <div className="console-table"><div className="table-head"><span>Signal</span><span>Evidence</span><span>Status</span></div>{diligenceRows.map(([signal, evidence, status]) => <div className="table-row" key={signal}><span>{signal}</span><span>{evidence}</span><b className={status === "Verified" ? "verified" : "request"}>{status === "Verified" ? <Check size={12} /> : <ChevronRight size={12} />}{status}</b></div>)}</div>
        <div className="console-foot"><span>Public information current as of 2026. Performance and commercial metrics require internal verification.</span><a href="https://advcosinc.com/contact/">Request controlled access <ArrowUpRight size={14} /></a></div>
      </div>
    </section>

    <section className="cta" id="rfq"><div className="cta-grid" aria-hidden="true" /><div><SectionTag index="06" light>Next program</SectionTag><h2>Bring us the<br /><em>difficult part.</em></h2><p>Send the drawing, material requirement and production target. We’ll review fit, process and the questions that matter next.</p><div className="cta-actions"><SlideButton href="https://advcosinc.com/quote/">Start a confidential RFQ</SlideButton><a href="https://advcosinc.com/contact/">Talk to an engineer <ArrowUpRight size={15} /></a></div></div><aside><span>Secure intake</span><b>PDF · CAD · STEP</b><p>Controlled drawings and program information flow through the existing secure quote workflow.</p><a href="https://advcosinc.com/quote/">Open secure portal <ArrowUpRight size={14} /></a></aside></section>

    <footer><div className="footer-mark"><span>ADV</span><b>ANCED</b></div><p>Partners in manufacturing and distribution.<br />Owasso, Oklahoma.</p><nav><a href="#thesis">Why Advanced</a><a href="#capabilities">Capabilities</a><a href="#evidence">Evidence</a><a href="#quality">Quality</a><a href="https://recruiting.paylocity.com/recruiting/jobs/All/cb3507b0-4095-42c8-b12e-1ae0872126d2/ADVANCED-MACHINING-FABRIC">Careers ↗</a></nav><div className="footer-bottom"><span>© 2026 Advanced</span><a href="https://advcosinc.com/privacy-policy/">Privacy</a><a href="https://advcosinc.com/contact/">Contact</a><b>Precision in motion</b></div></footer>
  </main>;
}
