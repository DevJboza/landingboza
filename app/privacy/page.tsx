import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Tratamiento de datos en los servicios de Johan Boza que utilizan WhatsApp Business Cloud API.",
  alternates: { canonical: "https://boza.lat/privacy" },
  openGraph: {
    type: "website",
    locale: "es_CR",
    siteName: "Johan Boza",
    title: "Política de Privacidad | Johan Boza",
    description: "Privacidad y tratamiento de datos en nuestros servicios de WhatsApp.",
    url: "https://boza.lat/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main>
      <nav className="nav wrap" aria-label="Navegación principal">
        <Link className="brand" href="/" aria-label="Johan Boza, inicio">JOHAN<span>BOZA</span></Link>
        <div className="nav-links">
          <Link href="/#soluciones">Soluciones</Link><Link href="/#proyectos">Proyectos</Link><Link href="/#proceso">Proceso</Link>
          <Link className="nav-button" href="/#contacto">Hablemos <span aria-hidden="true">↗</span></Link>
        </div>
      </nav>

      <header className={styles.header}>
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className={`wrap ${styles.heading}`}>
          <p className="kicker">Johan Boza · Privacidad</p>
          <h1>Política de <span>Privacidad</span></h1>
          <p className="lead">Información sobre el tratamiento de datos personales en nuestros servicios que utilizan WhatsApp Business Cloud API de Meta.</p>
          <p className={styles.updated}>Última actualización: <time dateTime="2026-09-25">25 de septiembre de 2026</time></p>
        </div>
      </header>

      <article className={`wrap ${styles.content}`} aria-label="Política de Privacidad">
        <section aria-labelledby="responsable">
          <h2 id="responsable">1. Responsable y alcance</h2>
          <p>Johan Boza, con presencia en boza.lat y ubicado en San Vito, Puntarenas, Costa Rica, es el contacto responsable de esta política. Esta política describe cómo se procesan los datos personales al interactuar con nuestra aplicación y los servicios que utilizan WhatsApp Business Cloud API.</p>
        </section>

        <section aria-labelledby="datos">
          <h2 id="datos">2. Datos que podemos procesar</h2>
          <ul>
            <li>Números de teléfono y nombres o nombres de perfil de los usuarios.</li>
            <li>Mensajes enviados y recibidos por WhatsApp, incluidos los archivos o contenidos que el usuario comparta.</li>
            <li>Datos necesarios para prestar el servicio solicitado, como información de una consulta, solicitud o preferencia que el usuario facilite.</li>
            <li>Datos técnicos de la comunicación, como identificadores de mensajes, fechas y estados de entrega, necesarios para operar el servicio.</li>
          </ul>
        </section>

        <section aria-labelledby="uso">
          <h2 id="uso">3. Para qué utilizamos los datos</h2>
          <p>Utilizamos estos datos para responder mensajes, automatizar la atención y proporcionar las funciones solicitadas por el usuario. También pueden utilizarse para dar seguimiento a consultas, mantener el funcionamiento del servicio y resolver incidencias relacionadas con las comunicaciones.</p>
        </section>

        <section aria-labelledby="terceros">
          <h2 id="terceros">4. Proveedores y terceros</h2>
          <p>No vendemos datos personales a terceros.</p>
          <p>Para prestar el servicio, los datos pueden ser procesados por Meta, como proveedor de WhatsApp Business Cloud API, y por los proveedores técnicos necesarios para alojar y operar las funciones solicitadas. La información se comparte en la medida necesaria para esos fines o cuando exista una obligación legal.</p>
          <p>El uso de WhatsApp también está sujeto a las condiciones y a la <a href="https://www.whatsapp.com/legal/privacy-policy">Política de Privacidad de WhatsApp</a>.</p>
        </section>

        <section aria-labelledby="conservacion">
          <h2 id="conservacion">5. Conservación y protección</h2>
          <p>Los datos se conservan durante el tiempo necesario para atender las solicitudes y prestar el servicio, o durante el plazo que exijan las obligaciones legales aplicables. El acceso se limita a las personas y proveedores que lo necesiten para esas finalidades.</p>
        </section>

        <section id="eliminacion" aria-labelledby="derechos">
          <h2 id="derechos">6. Solicitud de eliminación de datos</h2>
          <p>Puedes solicitar la eliminación de tus datos personales escribiendo a <a href="mailto:contacto@boza.lat?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos">contacto@boza.lat</a> con el asunto «Solicitud de eliminación de datos».</p>
          <p>Indica el número de teléfono con el que utilizaste el servicio, incluido el código de país, y qué datos deseas eliminar. Podremos solicitar la información mínima necesaria para verificar que la solicitud corresponde al titular de los datos.</p>
          <p>Te informaremos del resultado de la solicitud. Si algún dato debe conservarse por una obligación legal, te explicaremos el motivo. La solicitud abarca los datos bajo nuestro control; los datos que WhatsApp gestione de forma independiente se rigen por sus propias políticas.</p>
          <p>También puedes utilizar este correo para consultar sobre tus datos o solicitar su acceso o corrección.</p>
        </section>

        <section aria-labelledby="contacto-privacidad">
          <h2 id="contacto-privacidad">7. Contacto</h2>
          <p>Si tienes preguntas sobre esta política o el tratamiento de tus datos, contacta a Johan Boza en <a href="mailto:contacto@boza.lat">contacto@boza.lat</a>.</p>
        </section>

        <section aria-labelledby="cambios">
          <h2 id="cambios">8. Cambios en esta política</h2>
          <p>Las actualizaciones se publicarán en esta página e indicarán su fecha de última actualización.</p>
        </section>

        <Link className="button ghost" href="/">Volver al inicio <span aria-hidden="true">↗</span></Link>
      </article>

      <footer className="wrap"><Link className="brand" href="/">JOHAN<span>BOZA</span></Link><span>© 2026 · Web · Automatización · IA</span><a href="mailto:contacto@boza.lat">contacto@boza.lat</a></footer>
    </main>
  );
}
