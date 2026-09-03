"use client";

import { FormEvent, useState } from "react";

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const business = String(data.get("business") ?? "").trim();
    const need = String(data.get("need") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    const subject = encodeURIComponent(`Consulta de ${name || business || "un negocio"}`);
    const body = encodeURIComponent(`Hola Johan,\n\nMi nombre es ${name}.\nNegocio: ${business}.\nMe interesa: ${need}.\n\n${message}`);
    setSent(true);
    window.location.href = `mailto:contacto@boza.lat?subject=${subject}&body=${body}`;
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="field-row">
        <label>Tu nombre<input name="name" autoComplete="name" required /></label>
        <label>Tu negocio<input name="business" autoComplete="organization" required /></label>
      </div>
      <label>¿Qué necesitas?
        <select name="need" defaultValue="" required>
          <option value="" disabled>Selecciona una opción</option>
          <option>Una página web</option><option>Automatizar un proceso</option><option>Un asistente con IA</option>
          <option>Integrar herramientas</option><option>No estoy seguro todavía</option>
        </select>
      </label>
      <label>Cuéntame un poco más<textarea name="message" rows={4} required /></label>
      <button type="submit">Preparar mi consulta <span aria-hidden="true">↗</span></button>
      <small>{sent ? "Tu aplicación de correo debería abrirse con el mensaje listo." : "El formulario prepara un correo; podrás revisarlo antes de enviarlo."}</small>
    </form>
  );
}
