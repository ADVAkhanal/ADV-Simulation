const capabilities = [
  { index: "01", title: "Precision machining", statement: "Complex geometries across 3-, 4- and 5-axis workflows.", details: [["Processes", "3-axis vertical, 4-axis horizontal, 5-axis multi-task"], ["Materials", "Aluminum, titanium, nickel alloys, CRES, engineered plastics"], ["Automation", "FMS robotic Fastems system and palletized production"], ["Tolerance", "Drawing-dependent — confirm through RFQ"]] },
  { index: "02", title: "Fabrication", statement: "Production support for demanding industrial and food-processing applications.", details: [["Applications", "Packaging, wear items, OEM replacement and MRO"], ["Standards", "FDA- and NSF-compliant materials when specified"], ["Part envelope", "Project-specific — drawing review required"], ["Volume", "Prototype and production scope confirmed by RFQ"]] },
  { index: "03", title: "Plastics", statement: "Material selection, distribution and machining under one roof.", details: [["Forms", "Rod, sheet, tube and film"], ["Families", "Thermoset, thermoplastic and elastomeric"], ["Grades", "High-performance, engineered and general industrial"], ["Support", "Application-specific material guidance"]] },
  { index: "04", title: "Assembly", statement: "Close-precision parts and assemblies for controlled programs.", details: [["Programs", "Aerospace, defense, energy and industrial"], ["Support", "New program development, legacy and MRO"], ["Documentation", "Requirements reviewed per customer program"], ["Capacity", "Assembly scope confirmed through engineering review"]] },
  { index: "05", title: "Inspection + quality", statement: "Measurement and traceability built into the production path.", details: [["Systems", "AS9100 and ISO 9001 certified QMS"], ["Equipment", "Zeiss and DuraMax coordinate measuring machines"], ["Controls", "First-article, in-process and final inspection"], ["Records", "Program-specific traceability and documentation"]] },
  { index: "06", title: "Engineering support", statement: "Technical collaboration before the first chip is cut.", details: [["Review", "Print, material and manufacturability alignment"], ["Planning", "Process selection and production routing"], ["Launch", "New-program and legacy-part support"], ["Input", "STEP, CAD and PDF files accepted through RFQ"]] },
];
const proof = [["1979", "Founded in Owasso, Oklahoma"], ["3", "Fully equipped shops onsite"], ["50+", "Manufacturing professionals"], ["2", "AS9100 + ISO 9001 certifications"]];
const projects = [
  { image: "/work-longeron.jpg", industry: "Aerospace", title: "Upper-door longeron assembly", material: "7050-T7451 aluminum", process: "5-axis mill", size: "2.50 × 11.93 × 25.25 in", note: "Customer challenge and measured program outcome are confidential / pending publication." },
  { image: "/work-door-hinge.jpg", industry: "Aerospace", title: "Main landing-gear door hinge", material: "6AL-4V titanium", process: "4-axis horizontal mill", size: "3.00 × 5.50 × 14.00 in", note: "Tolerance and production-volume details are available through controlled project review." },
  { image: "/work-motorlead.jpeg", industry: "Oil + gas", title: "Motor-lead housing", material: "K-500 Monel", process: "5-axis multi-task", size: "Ø 3.50 × 4.00 in", note: "Application constraints and measured outcome are available where disclosure permits." },
];
const timeline = [
  ["1979", "Advanced Plastics opens for industrial sales and nationwide distribution."],
  ["1981", "Aerospace manufacturing begins with work supporting the DC-9 program."],
  ["1984", "The first full 3-axis CNC machines enter production."],
  ["1998", "Advanced invests in its first mill-turn, multi-axis machining centers."],
  ["2007", "The quality system achieves dual AS9100 and ISO 9001 certification."],
  ["2016", "An FMS robotic Fastems system advances automated production."],
  ["2023", "Advanced Plastics Inc. becomes a wholly owned subsidiary."],
];
export default function Home() {
  const schema = { "@context": "https://schema.org", "@type": "ManufacturingBusiness", name: "Advanced", url: "https://advcosinc.com", foundingDate: "1979", address: { "@type": "PostalAddress", addressLocality: "Owasso", addressRegion: "OK", addressCountry: "US" }, areaServed: "United States", knowsAbout: ["Precision machining", "Engineered plastics", "Aerospace manufacturing", "Oil and gas manufacturing", "Food processing components"] };
  return <main>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Advanced home"><img src="/advanced-logo.jpg" alt="Advanced — Partners in Manufacturing and Distribution" /></a>
      <nav className="desktop-nav" aria-label="Primary navigation"><a href="#solutions">Solutions</a><a href="#industries">Industries</a><a href="#quality">Quality</a><a href="#work">Work</a><a href="#company">Company</a><a href="https://recruiting.paylocity.com/recruiting/jobs/All/cb3507b0-4095-42c8-b12e-1ae0872126d2/ADVANCED-MACHINING-FABRIC">Careers</a><a href="#rfq">Contact</a></nav>
      <a className="header-rfq" href="https://advcosinc.com/quote/">Request a quote <span aria-hidden="true">↗</span></a>
    </header>
    <section className="hero" id="top">
      <video className="hero-video" autoPlay muted loop playsInline preload="metadata" poster="/og.png" aria-hidden="true"><source src="https://advcosinc.com/wp-content/uploads/2024/07/Advance-Intro-Reel-Long_2.mp4" type="video/mp4" /></video>
      <div className="hero-overlay" /><div className="scan-grid" aria-hidden="true"><i /><i /><i /></div>
      <div className="hero-content" id="main-content">
        <p className="kicker"><span>Precision in motion</span><b>Owasso, Oklahoma</b></p>
        <h1>Precision engineered<br />for demanding industries.</h1>
        <div className="hero-bottom"><p>Advanced delivers complex machining, fabrication and manufacturing solutions backed by rigorous quality systems, experienced teams and dependable execution.</p><div className="hero-actions"><a className="button button-red" href="https://advcosinc.com/quote/">Start a project <span>↗</span></a><a className="button button-ghost" href="#solutions">Explore capabilities <span>↓</span></a></div></div>
      </div>
      <div className="trust-strip" id="industries"><span>Aerospace</span><span>Defense</span><span>Oil + gas</span><span>Food processing</span><span>Plastic distribution</span></div>
    </section>
    <section className="intro section-shell">
      <div className="section-label"><span>00</span><p>Position</p></div>
      <div className="intro-copy"><h2>Raw stock in.<br /><em>Certainty</em> out.</h2><p>Every program begins with requirements: material, geometry, documentation and delivery. Advanced turns those constraints into a controlled manufacturing path—from engineering review and automated machining to measured inspection.</p></div>
      <div className="material-sequence" aria-label="Manufacturing transformation"><div><b>01</b><span>Raw material</span></div><i>→</i><div><b>02</b><span>Engineered process</span></div><i>→</i><div><b>03</b><span>Measured component</span></div></div>
    </section>
    <section className="capabilities section-shell" id="solutions">
      <div className="section-heading"><div className="section-label"><span>01</span><p>Capabilities</p></div><h2>Built around the<br />part in front of us.</h2><p>Select a capability to see the verified systems behind it. Specifications that vary by drawing are marked for RFQ review.</p></div>
      <div className="capability-list">{capabilities.map((item, index) => <details key={item.index} open={index === 0} name="capability"><summary><span>{item.index}</span><h3>{item.title}</h3><p>{item.statement}</p><b aria-hidden="true">+</b></summary><div className="capability-detail">{item.details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></details>)}</div>
    </section>
    <section className="proof" aria-labelledby="proof-title">
      <div className="proof-top section-shell"><div className="section-label light"><span>02</span><p>Verified scale</p></div><h2 id="proof-title">Experience measured<br />in capability.</h2></div>
      <div className="proof-grid">{proof.map(([number, label]) => <div key={number}><strong>{number}</strong><span>{label}</span></div>)}</div>
      <p className="proof-note">Public company information current as of 2026. Machine count, supported tolerance range and delivery performance require internal verification before publication.</p>
    </section>
    <section className="work section-shell" id="work">
      <div className="section-heading work-heading"><div className="section-label"><span>03</span><p>Selected work</p></div><h2>Complex parts.<br />Specific evidence.</h2><a href="https://advcosinc.com/gallery/">View the full gallery <span>↗</span></a></div>
      <div className="project-grid">{projects.map((project, index) => <article className={`project project-${index + 1}`} key={project.title}><div className="project-image"><img src={project.image} alt={`${project.title} manufactured by Advanced`} loading="lazy" /><span>0{index + 1}</span></div><p className="project-industry">{project.industry}</p><h3>{project.title}</h3><dl><div><dt>Material</dt><dd>{project.material}</dd></div><div><dt>Process</dt><dd>{project.process}</dd></div><div><dt>Envelope</dt><dd>{project.size}</dd></div></dl><p className="project-note">{project.note}</p></article>)}</div>
    </section>
    <section className="quality" id="quality">
      <div className="quality-visual" aria-hidden="true"><div className="quality-rings"><span>Q</span></div><p>Inspection datum / 00.000</p></div>
      <div className="quality-content"><div className="section-label light"><span>04</span><p>Quality systems</p></div><h2>Quality is<br />visible here.</h2><p className="quality-lead">Evidence lives in the system: certified standards, controlled measurement, documented inspection and a repeatable path from print review to final release.</p><div className="cert-grid"><div><strong>AS9100</strong><span>Aerospace quality management</span></div><div><strong>ISO 9001</strong><span>Quality management system</span></div></div><ol className="quality-flow"><li><span>01</span>Requirement review</li><li><span>02</span>First-article inspection</li><li><span>03</span>In-process control</li><li><span>04</span>CMM verification</li><li><span>05</span>Final release + records</li></ol><p className="quality-equipment"><span>Inspection equipment</span>Zeiss and DuraMax coordinate measuring machines</p></div>
    </section>
    <section className="company section-shell" id="company">
      <div className="company-intro"><div className="section-label"><span>05</span><p>Company history</p></div><h2>Built to evolve.<br />Grounded in 1979.</h2><p>Advanced began in plastics distribution, moved into aerospace manufacturing, and kept investing in the machines, automation and quality systems required by the next program.</p></div>
      <div className="timeline">{timeline.map(([year, event], index) => <article key={year}><span>0{index + 1}</span><time>{year}</time><p>{event}</p></article>)}</div>
    </section>
    <section className="rfq" id="rfq">
      <div className="rfq-copy"><div className="section-label light"><span>06</span><p>Start a program</p></div><h2>Bring us the<br /><em>difficult</em> part.</h2><p>Send the drawing, material requirement and production target. An Advanced team member can review fit, process and the next technical questions.</p><div className="confidentiality"><b>NDA + confidentiality</b><span>Controlled drawings and program information are handled through the existing secure quote workflow.</span></div></div>
      <div className="rfq-panel"><p className="rfq-panel-title">Project intake</p><div className="rfq-fields" aria-label="RFQ information preview"><label>Company<input type="text" placeholder="Organization name" /></label><label>Work email<input type="email" placeholder="name@company.com" /></label><label className="field-wide">Project summary<textarea placeholder="Material, quantity, schedule and critical requirements" rows={4} /></label></div><a className="upload-zone" href="https://advcosinc.com/quote/"><span><b>Upload drawings securely</b><small>PDF, CAD, STEP and specification files · Existing portal supports files up to 2 GB</small></span><strong>Browse ↗</strong></a><div className="rfq-actions"><a className="button button-red" href="https://advcosinc.com/quote/">Request a quote <span>↗</span></a><a href="https://advcosinc.com/contact/">Talk to an engineer <span>↗</span></a></div></div>
    </section>
    <footer><a className="footer-brand" href="#top"><img src="/advanced-logo.jpg" alt="Advanced" /></a><p>Partners in manufacturing and distribution.<br />Owasso, Oklahoma.</p><nav aria-label="Footer navigation"><a href="#solutions">Solutions</a><a href="#quality">Quality</a><a href="#work">Work</a><a href="#company">Company</a><a href="https://recruiting.paylocity.com/recruiting/jobs/All/cb3507b0-4095-42c8-b12e-1ae0872126d2/ADVANCED-MACHINING-FABRIC">Careers ↗</a></nav><div className="footer-meta"><span>© 2026 Advanced</span><a href="https://advcosinc.com/privacy-policy/">Privacy</a><a href="https://advcosinc.com/contact/">Contact</a></div></footer>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  </main>;
}
