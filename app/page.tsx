import Image from "next/image";
import ContactForm from "./contact-form";

const solutions = [
  { number: "01", title: "Desarrollo web", copy: "Sitios creados para convertir visitas en clientes: landing pages, catálogos, reservas y sistemas personalizados." },
  { number: "02", title: "Automatización", copy: "Conecto formularios, correo, CRM, calendarios y las herramientas que ya utiliza tu negocio." },
  { number: "03", title: "Asistentes con IA", copy: "Responde consultas, captura prospectos y transfiere las conversaciones importantes a tu equipo." },
  { number: "04", title: "Integraciones", copy: "APIs, webhooks, bases de datos y sistemas internos para que tus herramientas trabajen juntas." },
];

const steps = [
  ["01", "Diagnóstico", "Entiendo dónde pierdes tiempo, consultas o ventas."],
  ["02", "Propuesta", "Definimos una solución clara, alcance y precio."],
  ["03", "Desarrollo", "Construyo, pruebo y te muestro avances concretos."],
  ["04", "Lanzamiento", "Publicamos y dejamos todo listo para trabajar."],
];

const mapUrl = "https://www.openstreetmap.org/export/embed.html?bbox=-82.9863%2C8.8070%2C-82.9563%2C8.8367&layer=mapnik&marker=8.8218324%2C-82.9712649";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Johan Boza",
    url: "https://www.boza.lat",
    email: "contacto@boza.lat",
    description: "Desarrollo web, automatización e inteligencia artificial para negocios en Costa Rica.",
    areaServed: { "@type": "Country", name: "Costa Rica" },
    address: { "@type": "PostalAddress", addressLocality: "San Vito", addressRegion: "Puntarenas", addressCountry: "CR" },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav className="nav wrap" aria-label="Navegación principal">
        <a className="brand" href="#inicio" aria-label="Johan Boza, inicio">JOHAN<span>BOZA</span></a>
        <div className="nav-links">
          <a href="#soluciones">Soluciones</a><a href="#proyectos">Proyectos</a><a href="#proceso">Proceso</a>
          <a className="nav-button" href="#contacto">Hablemos <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <section id="inicio" className="hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-glow glow-one" aria-hidden="true" />
        <div className="hero-glow glow-two" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="kicker">Desarrollo web · Automatización · IA · Costa Rica</p>
            <h1>Webs que consiguen clientes. <i>Sistemas que trabajan por ti.</i></h1>
            <p className="lead">Desarrollo sitios web y automatizaciones para negocios que quieren generar más consultas, responder más rápido y reducir tareas manuales.</p>
            <div className="actions">
              <a className="button primary" href="#contacto">Cuéntame qué quieres mejorar <b aria-hidden="true">↗</b></a>
              <a className="button ghost" href="#soluciones">Ver soluciones</a>
            </div>
            <div className="availability"><span aria-hidden="true" /> SISTEMAS ACTIVOS · DISPONIBLE EN COSTA RICA</div>
          </div>
          <div className="hero-visual" aria-label="Johan Boza, desarrollador full stack">
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="portrait-card">
              <Image src="/yo_circulo.webp" alt="Johan Boza, desarrollador web y especialista en automatización" width={900} height={900} priority unoptimized sizes="(max-width: 760px) 230px, 280px" />
              <div><strong>Johan Boza</strong><small>Web · Automatización · IA</small></div>
            </div>
            <div className="tech-tag tag-one">NEXT.JS</div>
            <div className="tech-tag tag-two">N8N</div>
            <div className="tech-tag tag-three">AI</div>
            <p className="visual-stamp">BUILD<br />SYSTEMS<br />THAT WORK</p>
          </div>
        </div>
      </section>

      <section className="problems" aria-labelledby="problems-title">
        <div className="wrap problems-grid">
          <div><p className="kicker">El problema no es solo tu página</p><h2 id="problems-title">Cada consulta perdida y cada tarea repetida cuesta.</h2></div>
          <div className="problem-list">
            <p><span>01</span> Tu negocio no se encuentra o no transmite confianza.</p>
            <p><span>02</span> Los clientes esperan demasiado por una respuesta.</p>
            <p><span>03</span> Copias información manualmente entre varias herramientas.</p>
          </div>
        </div>
      </section>

      <section id="soluciones" className="dark-section">
        <div className="wrap">
          <p className="kicker light">Soluciones para hacer crecer tu negocio</p>
          <div className="service-header">
            <h2>Tu presencia digital.<br />Y lo que ocurre después.</h2>
            <p>Tecnología explicada con claridad y construida alrededor de un resultado: más oportunidades y menos trabajo manual.</p>
          </div>
          <div className="service-grid">
            {solutions.map((solution) => <article key={solution.number}><span>{solution.number}</span><h3>{solution.title}</h3><p>{solution.copy}</p><b aria-hidden="true">↗</b></article>)}
          </div>
        </div>
      </section>

      <section className="automation">
        <div className="wrap automation-grid">
          <div className="automation-copy">
            <p className="kicker">Un ejemplo sencillo</p><h2>Mientras tú trabajas, tu sistema también.</h2>
            <p>Una consulta puede registrarse, avisar a tu equipo, responder al cliente y programar un seguimiento sin copiar datos ni depender de la memoria.</p>
            <a className="inline-link" href="#contacto">Quiero automatizar un proceso ↗</a>
          </div>
          <div className="flow" aria-label="Ejemplo de flujo automatizado">
            <div className="flow-trigger"><small>ENTRADA</small><strong>Nuevo cliente</strong><span>Formulario · WhatsApp · Web</span></div>
            <div className="flow-line" aria-hidden="true"><span>BOZA AUTOMATION</span></div>
            <div className="flow-actions">
              <div><b>01</b><span>Registrar lead</span></div><div><b>02</b><span>Notificar equipo</span></div>
              <div><b>03</b><span>Enviar respuesta</span></div><div><b>04</b><span>Crear seguimiento</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="proyectos" className="work wrap">
        <p className="kicker">Proyectos seleccionados</p><h2>Construido para funcionar.<br /><i>Diseñado para destacar.</i></h2>
        <div className="project-grid">
          <a className="project bossly" href="https://bosslycraft-store.vercel.app" target="_blank" rel="noreferrer">
            <div className="project-top"><div className="project-logo">B<span>C</span></div><span className="project-open">Ver proyecto ↗</span></div>
            <div><p>ECOMMERCE · MINECRAFT</p><h3>BosslyCraft</h3><p className="project-result">Tienda digital para presentar productos y facilitar compras dentro de una comunidad online.</p><span className="project-tech">Next.js · TypeScript · Prisma · PostgreSQL · Tebex</span></div>
          </a>
          <a className="project bossfit" href="https://bossfit.vercel.app" target="_blank" rel="noreferrer">
            <div className="project-top"><div className="fit-icon">↗</div><span className="project-open">Ver proyecto ↗</span></div>
            <div><p>APP DE HÁBITOS · PWA</p><h3>BossFit</h3><p className="project-result">Aplicación instalable para registrar hábitos, visualizar el progreso y mantener constancia.</p><span className="project-tech">Next.js · React · TypeScript · Zustand · Supabase</span></div>
          </a>
        </div>
      </section>

      <section id="proceso" className="process">
        <div className="wrap">
          <p className="kicker">Cómo trabajamos</p>
          <div className="process-heading"><h2>De la idea a un sistema funcionando.</h2><p>Sin procesos complicados ni lenguaje técnico innecesario.</p></div>
          <div className="process-grid">{steps.map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
      </section>

      <section className="care"><div className="wrap care-card">
        <div><p className="kicker light">Boza Care</p><h2>Yo me encargo de que siga funcionando.</h2></div>
        <div><p>Soporte, hosting, monitoreo, actualizaciones y mejoras continuas después del lanzamiento.</p><a href="#contacto">Consultar mantenimiento ↗</a></div>
      </div></section>

      <section id="zona" className="location">
        <div className="wrap location-grid">
          <div className="location-copy"><p className="kicker">Trabajo desde</p><h2>San Vito,<br />Puntarenas.</h2><p>Atiendo negocios de la Zona Sur y desarrollo proyectos para clientes en todo Costa Rica.</p><a className="inline-link" href="https://www.google.com/maps/place/Provincia+de+Puntarenas,+San+Vito/@8.8224377,-82.9736373,15z" target="_blank" rel="noreferrer">Abrir ubicación en Google Maps ↗</a></div>
          <div className="map-card"><iframe title="Mapa de San Vito, Puntarenas" src={mapUrl} loading="lazy" /><div className="map-label"><span aria-hidden="true">●</span><div><strong>San Vito, Puntarenas</strong><small>Zona de trabajo</small></div></div></div>
        </div>
      </section>

      <section id="contacto" className="contact">
        <div className="wrap contact-grid">
          <div><p className="kicker">Hablemos de tu negocio</p><h2>¿Qué haces manualmente <i>todos los días?</i></h2><p className="contact-lead">Cuéntame qué quieres mejorar o automatizar. Te responderé con el próximo paso más útil, sin compromiso.</p><a className="contact-mail" href="mailto:contacto@boza.lat">contacto@boza.lat <b aria-hidden="true">↗</b></a></div>
          <ContactForm />
        </div>
      </section>

      <footer className="wrap"><a className="brand" href="#inicio">JOHAN<span>BOZA</span></a><span>© 2026 · Web · Automatización · IA</span><a href="mailto:contacto@boza.lat">contacto@boza.lat</a></footer>
    </main>
  );
}
