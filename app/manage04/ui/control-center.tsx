"use client";
import {
  type CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Conversation,
  Followup,
  Lead,
  OutreachItem,
  Prospect,
  Quote,
} from "@/lib/manage/types";

type View =
  | "dashboard"
  | "conversations"
  | "prospects"
  | "leads"
  | "quotes"
  | "followups"
  | "agent"
  | "automations"
  | "settings";
type Activity = { time: string; text: string; detail: string };
type DashboardData = {
  metrics: Record<string, number>;
  activity: number[];
  activities: Activity[];
  leadFunnel: { name: string; value: number }[];
  agentOnline: boolean;
};
type AgentData = {
  online: boolean;
  model: string;
  provider: string;
  activeSessions: number;
  messagesProcessed: number;
  fallbacks: number;
  humanChats: number;
  settings: Record<string, string | number | boolean>;
};
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
type Initial = {
  dashboard: DashboardData;
  conversations: Conversation[];
  prospects: Prospect[];
  leads: Lead[];
  quotes: Quote[];
  followups: Followup[];
  outreach: OutreachItem[];
  agent: AgentData;
};
const nav: [View, string, string][] = [
  ["dashboard", "Dashboard", "⌂"],
  ["conversations", "Conversaciones", "◫"],
  ["prospects", "Prospectos", "◎"],
  ["leads", "Leads", "◇"],
  ["quotes", "Cotizaciones", "▤"],
  ["followups", "Seguimientos", "◷"],
  ["agent", "Agente", "✦"],
  ["automations", "Automatizaciones", "⌁"],
  ["settings", "Configuración", "⚙"],
];
const stageNames: Record<string, string> = {
  NEW: "Nuevo",
  CONTACTED: "Contactado",
  REPLIED: "Respondió",
  INTERESTED: "Interesado",
  QUALIFIED: "Calificado",
  QUOTE: "Cotización",
  MEETING: "Reunión",
  WON: "Ganado",
  LOST: "Perdido",
};
async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/manage/${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error?.message || "Ocurrió un error");
  return body.data;
}
export default function ControlCenter({ initial }: { initial: Initial }) {
  const [data, setData] = useState(initial),
    [dataState, setDataState] = useState<"loading" | "ready" | "error">(
      "loading",
    );
  const [view, setView] = useState<View>("dashboard"),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [toast, setToast] = useState(""),
    [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
      null,
    ),
    [notifications, setNotifications] = useState(false),
    [palette, setPalette] = useState(false),
    [agent, setAgent] = useState(initial.agent);
  useEffect(() => {
    navigator.serviceWorker
      ?.getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => undefined);
    caches
      ?.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
    const handler = (event: Event) => {
      const e = event as InstallPromptEvent;
      e.preventDefault();
      setInstallPrompt(e);
    };
    addEventListener("beforeinstallprompt", handler);
    const keys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    addEventListener("keydown", keys);
    return () => {
      removeEventListener("beforeinstallprompt", handler);
      removeEventListener("keydown", keys);
    };
  }, []);
  useEffect(() => {
    let active = true;
    api("bootstrap")
      .then((fresh: Initial) => {
        if (!active) return;
        setData(fresh);
        setAgent(fresh.agent);
        setDataState("ready");
      })
      .catch(() => {
        if (active) setDataState("error");
      });
    return () => {
      active = false;
    };
  }, []);
  function go(v: View) {
    setView(v);
    setMenu(false);
    setPalette(false);
  }
  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }
  async function logout() {
    await fetch("/api/manage/auth/logout", { method: "POST" });
    location.reload();
  }
  async function toggleAgent() {
    if (
      agent.online &&
      !confirm(
        "¿Pausar el agente global? Las respuestas automáticas se detendrán.",
      )
    )
      return;
    const data = await api(`agent/${agent.online ? "pause" : "resume"}`, {
      method: "POST",
      body: "{}",
    });
    setAgent(data);
    notify(agent.online ? "Agente pausado" : "Agente reanudado");
  }
  const results = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return [];
    return [
      ...data.conversations.map((x) => ({
        label: x.business,
        detail: x.name,
        view: "conversations" as View,
      })),
      ...data.prospects.map((x) => ({
        label: x.business,
        detail: x.category,
        view: "prospects" as View,
      })),
      ...data.leads.map((x) => ({
        label: x.business,
        detail: stageNames[x.stage],
        view: "leads" as View,
      })),
    ]
      .filter((x) => `${x.label} ${x.detail}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, data]);
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="side-head">
          <div className="mini-mark">B</div>
          <div>
            <b>BOZA</b>
            <small>CONTROL CENTER</small>
          </div>
          <button
            className="close-menu"
            onClick={() => setMenu(false)}
            aria-label="Cerrar menú"
          >
            ×
          </button>
        </div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <span>{icon}</span>
              {label}
              {id === "conversations" &&
                data.conversations.reduce((sum, item) => sum + item.unread, 0) >
                  0 && (
                  <i>
                    {data.conversations.reduce(
                      (sum, item) => sum + item.unread,
                      0,
                    )}
                  </i>
                )}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="system-pulse">
            <span />
            <div>
              <b>Sistema operativo</b>
              <small>Todos los servicios estables</small>
            </div>
          </div>
          <button onClick={logout}>⇥ Cerrar sesión</button>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          onClick={() => setMenu(false)}
          aria-label="Cerrar menú"
        />
      )}
      <main className="workspace">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="page-title">
            <small>BOZA CONTROL CENTER</small>
            <b>{nav.find((x) => x[0] === view)?.[1]}</b>
          </div>
          <div className="top-actions">
            <div className="global-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en Control Center"
                aria-label="Buscar"
              />
              <kbd>⌘ K</kbd>
              {results.length > 0 && (
                <div className="search-results">
                  {results.map((x, i) => (
                    <button
                      key={`${x.label}-${i}`}
                      onClick={() => {
                        go(x.view);
                        setSearch("");
                      }}
                    >
                      <b>{x.label}</b>
                      <small>{x.detail}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className={`agent-state ${agent.online ? "online" : "paused"}`}
              onClick={toggleAgent}
            >
              <span />
              {agent.online ? "Online" : "Pausado"}
            </button>
            <button
              className="icon-button"
              onClick={() => setNotifications(!notifications)}
              aria-label="Notificaciones"
            >
              ♢
            </button>
            <button
              className="quick"
              onClick={() => {
                go("prospects");
                notify("Formulario de prospecto listo");
              }}
            >
              ＋ Prospecto
            </button>
            <button className="avatar" title="Administrador">
              JB
            </button>
          </div>
          {notifications && <Notifications />}
        </header>
        <section className="content">
          {dataState === "loading" && (
            <div className="data-banner">Conectando con PostgreSQL…</div>
          )}
          {dataState === "error" && (
            <div className="data-banner error">
              No fue posible cargar los datos.{" "}
              <button onClick={() => location.reload()}>Reintentar</button>
            </div>
          )}
          {view === "dashboard" && <Dashboard data={data.dashboard} go={go} />}{" "}
          {view === "conversations" && (
            <Conversations initial={data.conversations} notify={notify} />
          )}{" "}
          {view === "prospects" && (
            <Prospects
              initial={data.prospects}
              outreach={data.outreach}
              notify={notify}
            />
          )}{" "}
          {view === "leads" && <Leads initial={data.leads} notify={notify} />}{" "}
          {view === "quotes" && <Quotes initial={data.quotes} notify={notify} />}{" "}
          {view === "followups" && (
            <Followups initial={data.followups} notify={notify} />
          )}{" "}
          {view === "agent" && <Agent data={agent} toggle={toggleAgent} />}{" "}
          {view === "automations" && <Automations />}{" "}
          {view === "settings" && <Settings />}
        </section>
      </main>
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
      {installPrompt && (
        <button
          className="install"
          onClick={() => {
            installPrompt.prompt();
            setInstallPrompt(null);
          }}
        >
          ↓ Instalar Control Center
        </button>
      )}
      {palette && (
        <CommandPalette
          go={go}
          close={() => setPalette(false)}
          toggleAgent={toggleAgent}
        />
      )}
    </div>
  );
}
function Dashboard({
  data,
  go,
}: {
  data: DashboardData;
  go: (v: View) => void;
}) {
  const cards = [
    ["Conversaciones activas", data.metrics.activeConversations, "Ahora", "◫"],
    ["Prospectos nuevos", data.metrics.newProspects, "Registrados", "◎"],
    ["Leads calientes", data.metrics.hotLeads, "Score ≥ 85", "◇"],
    [
      "Cotizaciones pendientes",
      data.metrics.pendingQuotes,
      "Por resolver",
      "▤",
    ],
    ["Seguimientos de hoy", data.metrics.todayFollowups, "Programados", "◷"],
    ["Mensajes procesados", data.metrics.messagesProcessed, "Total", "↗"],
  ];
  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">LUNES, 5 DE OCTUBRE</p>
          <h1>Buenos días, Johan.</h1>
          <p>Aquí está el pulso de tus operaciones hoy.</p>
        </div>
        <button onClick={() => go("conversations")}>
          Abrir bandeja <span>→</span>
        </button>
      </div>
      <div className="metric-grid">
        {cards.map((c, i) => (
          <article className="metric" key={String(c[0])}>
            <div>
              <span className={`metric-icon m${i}`}>{c[3]}</span>
              <small>{c[0]}</small>
            </div>
            <b>{c[1]}</b>
            <p>{c[2]}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <article className="panel activity-chart">
          <PanelHead
            title="Actividad"
            subtitle="Conversaciones de los últimos 7 días"
            action="Esta semana"
          />
          <div className="chart">
            <div className="chart-grid" />
            <div className="real-bars">
              {data.activity.map((value, index) => {
                const maximum = Math.max(1, ...data.activity);
                return (
                  <i
                    key={index}
                    style={{
                      height: `${Math.max(3, (value / maximum) * 100)}%`,
                    }}
                    title={`${value} mensajes`}
                  />
                );
              })}
            </div>
            <div className="chart-labels">
              <span>Lun</span>
              <span>Mar</span>
              <span>Mié</span>
              <span>Jue</span>
              <span>Vie</span>
              <span>Sáb</span>
              <span>Dom</span>
            </div>
          </div>
        </article>
        <article className="panel funnel">
          <PanelHead title="Embudo de leads" subtitle="Conversión actual" />
          <div className="funnel-list">
            {data.leadFunnel.map((item, i) => {
              const maximum = Math.max(
                1,
                ...data.leadFunnel.map((x) => x.value),
              );
              return (
                <div key={item.name}>
                  <span>{item.name}</span>
                  <div>
                    <i
                      style={{ width: `${(item.value / maximum) * 100}%` }}
                      className={`f${i}`}
                    />
                  </div>
                  <b>{item.value}</b>
                </div>
              );
            })}
          </div>
          <p className="conversion">
            <b>{data.leadFunnel.at(-1)?.value || 0}</b>
            <span>Leads ganados</span>
          </p>
        </article>
        <article className="panel recent">
          <PanelHead
            title="Actividad reciente"
            subtitle="Actualizaciones en tiempo real"
            action="Ver todo"
          />
          <div>
            {data.activities.map((a, i) => (
              <div className="activity-item" key={i}>
                <span className={`activity-dot a${i}`} />
                <div>
                  <b>{a.text}</b>
                  <small>{a.detail}</small>
                </div>
                <time>{a.time}</time>
              </div>
            ))}
          </div>
        </article>
        <article className="panel agent-card">
          <div className="agent-orb">
            <span>✦</span>
          </div>
          <div>
            <small>AGENTE BOZA</small>
            <h3>{data.agentOnline ? "Operando normalmente" : "En pausa"}</h3>
            <p>{data.metrics.messagesProcessed} mensajes procesados</p>
          </div>
          <span className="live-pill">
            <i /> EN VIVO
          </span>
        </article>
      </div>
    </>
  );
}
function PanelHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: string;
}) {
  return (
    <header className="panel-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action && <button>{action}⌄</button>}
    </header>
  );
}
function Conversations(props: {
  initial: Conversation[];
  notify: (s: string) => void;
}) {
  return <ConversationInbox {...props} />;
}
function ConversationInbox({
  initial,
  notify,
}: {
  initial: Conversation[];
  notify: (s: string) => void;
}) {
  const [list, setList] = useState(initial),
    [selected, setSelected] = useState(initial[0].id),
    [filter, setFilter] = useState("Todas"),
    [query, setQuery] = useState(""),
    [info, setInfo] = useState(false),
    [mobileChat, setMobileChat] = useState(false),
    [sending, setSending] = useState(false),
    [adding, setAdding] = useState(false);
  const current = list.find((x) => x.id === selected) || list[0];
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const fresh = (await api("conversations")) as Conversation[];
        if (active) setList(fresh);
      } catch {}
    }
    const timer = setInterval(refresh, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function addContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, fd = new FormData(form);
    const created = await api("contacts", { method: "POST", body: JSON.stringify({
      name: fd.get("name"), phone: fd.get("phone"), email: fd.get("email"), city: fd.get("city"),
      agentMode: fd.get("agentMode"),
    }) });
    setList((x) => [created, ...x.filter((c) => c.id !== created.id)]);
    setSelected(created.id); setAdding(false); form.reset(); notify("Contacto agregado");
  }
  const contactModal = adding && <div className="modal-backdrop" onClick={() => setAdding(false)}>
    <form className="small-modal" onSubmit={addContact} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="modal-close" onClick={() => setAdding(false)}>×</button>
      <h2>Agregar número al Control Center</h2>
      <p className="modal-help">Escribe el número con código de país y decide quién atenderá este chat.</p>
      <label>WhatsApp<input name="phone" required placeholder="506XXXXXXXX" /></label>
      <label>Nombre (opcional)<input name="name" /></label>
      <label>Modo<select name="agentMode" defaultValue="HUMAN">
        <option value="HUMAN">Humano — sin respuestas del bot</option>
        <option value="AUTO">Agente — respuestas automáticas</option>
        <option value="PAUSED">Pausado</option>
        <option value="IGNORE">Ignorar por completo</option>
      </select></label>
      <label>Email<input name="email" type="email" /></label>
      <label>Ciudad<input name="city" /></label>
      <button className="primary-action">Agregar contacto</button>
    </form>
  </div>;
  if (!current) return <><div className="empty"><span>◫</span><b>No hay conversaciones todavía</b>
    <small>Agrega un contacto o espera un mensaje de GREEN-API.</small>
    <button className="primary-action" onClick={() => setAdding(true)}>＋ Agregar contacto</button></div>{contactModal}</>;
  const shown = list.filter(
    (x) =>
      (filter === "Todas" ||
        (filter === "Nuevas" && x.status === "NEW") ||
        (filter === "Agente" && x.agentMode === "AUTO") ||
        (filter === "Humano" && x.agentMode === "HUMAN") ||
        (filter === "Pendientes" && x.status === "PENDING")) &&
      `${x.name} ${x.business}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function mode(action: string, label: string) {
    if (action === "close" && !confirm("¿Cerrar esta conversación?")) return;
    const updated = await api(`conversations/${current.id}/${action}`, {
      method: "POST",
      body: "{}",
    });
    setList((x) => x.map((c) => (c.id === updated.id ? updated : c)));
    notify(label);
  }
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const form = e.currentTarget;
    const body = String(new FormData(form).get("message") || "").trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await api(`conversations/${current.id}/message`, {
        method: "POST",
        body: JSON.stringify({ body, requestId: crypto.randomUUID() }),
      });
      setList((x) =>
        x.map((c) =>
          c.id === current.id
            ? { ...c, messages: [...c.messages, msg], lastMessage: body }
            : c,
        ),
      );
      form.reset();
      notify("Mensaje enviado");
    } finally {
      setSending(false);
    }
  }
  return (
    <div className={mobileChat ? "inbox mobile-chat-open" : "inbox"}>
      <section className="chat-list">
        <header>
          <div>
            <h1>Conversaciones</h1>
            <span>{list.filter((x) => x.unread).length} sin leer</span>
          </div>
          <button onClick={() => setAdding(true)} aria-label="Agregar número">＋ Número</button>
        </header>
        <div className="chat-search">
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversaciones"
          />
        </div>
        <div className="filters">
          {["Todas", "Nuevas", "Agente", "Humano", "Pendientes"].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="conversation-list">
          {shown.map((c) => (
            <button
              className={c.id === selected ? "selected" : ""}
              key={c.id}
              onClick={() => {
                setSelected(c.id);
                setMobileChat(true);
              }}
            >
              <span className="contact-avatar">
                {c.business
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div>
                <p>
                  <b>{c.business}</b>
                  <time>{c.lastMessageAt}</time>
                </p>
                <small>{c.name}</small>
                <p className="preview">{c.lastMessage}</p>
                <em className={`mode ${c.agentMode.toLowerCase()}`}>
                  {c.agentMode}
                </em>
                {c.unread > 0 && <i>{c.unread}</i>}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="chat-center">
        <header className="chat-header">
          <button
            className="mobile-back functional"
            onClick={() => setMobileChat(false)}
            aria-label="Volver a conversaciones"
          >
            ←
          </button>
          <button className="mobile-back">←</button>
          <span className="contact-avatar">
            {current.business.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <b>{current.business}</b>
            <small>
              {current.name} · {current.phone}
            </small>
          </div>
          <em className={`mode ${current.agentMode.toLowerCase()}`}>
            {current.agentMode}
          </em>
          <select className="mode-selector" value={current.agentMode} onChange={(e) => {
            const actions: Record<string, string> = { AUTO: "release", HUMAN: "take", PAUSED: "pause", IGNORE: "ignore", CLOSED: "close" };
            void mode(actions[e.target.value], `Modo cambiado a ${e.target.value}`);
          }} aria-label={`Cambiar modo de ${current.phone}`}>
            <option value="AUTO">Agente</option><option value="HUMAN">Humano</option>
            <option value="PAUSED">Pausado</option><option value="IGNORE">Ignorar</option><option value="CLOSED">Cerrado</option>
          </select>
          <button onClick={() => setInfo(true)} className="info-toggle">
            ⓘ
          </button>
        </header>
        <div className="quick-actions">
          <button onClick={() => mode("take", "Conversación tomada")}>
            ◉ Tomar
          </button>
          <button onClick={() => mode("release", "Devuelta al agente")}>
            ✦ Devolver al agente
          </button>
          <button onClick={() => mode("pause", "Agente pausado en este chat")}>
            Ⅱ Pausar
          </button>
          <button onClick={() => mode("close", "Conversación cerrada")}>
            × Cerrar
          </button>
          <button onClick={async () => {
            if (!confirm("¿Borrar este chat y todos sus mensajes? Esta acción no se puede deshacer.")) return;
            await api(`conversations/${current.id}`, { method: "DELETE" });
            const remaining = list.filter((c) => c.id !== current.id);
            setList(remaining); setSelected(remaining[0]?.id || ""); notify("Chat borrado");
          }}>Borrar</button>
        </div>
        <div className="messages">
          <div className="day-separator">
            <span>HOY</span>
          </div>
          {current.messages.map((m) => (
            <div className={`message ${m.direction}`} key={m.id}>
              <small>{m.author}</small>
              <p>{m.body}</p>
              <time>
                {m.at} {m.direction === "out" && "✓✓"}
              </time>
            </div>
          ))}
        </div>
        <form className="composer" onSubmit={send}>
          <button type="button">＋</button>
          <textarea
            name="message"
            rows={1}
            placeholder={
              current.agentMode === "CLOSED"
                ? "Conversación cerrada"
                : "Escribe un mensaje…"
            }
            disabled={current.agentMode === "CLOSED"}
          />
          <button
            type="submit"
            disabled={current.agentMode === "CLOSED" || sending}
          >
            {sending ? "Enviando…" : "Enviar ↑"}
          </button>
        </form>
      </section>
      <ClientInfo c={current} open={info} close={() => setInfo(false)} notify={notify}
        onUpdate={(updated) => setList((items) => items.map((item) => item.id === updated.id ? updated : item))} />
      {contactModal}
    </div>
  );
}
function ClientInfo({
  c,
  open,
  close,
  onUpdate,
  notify,
}: {
  c: Conversation;
  open: boolean;
  close: () => void;
  onUpdate: (c: Conversation) => void;
  notify: (s: string) => void;
}) {
  const [businessOpen, setBusinessOpen] = useState(false);
  async function registerBusiness(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form);
    const updated = await api(`conversations/${c.id}/business`, { method: "PATCH", body: JSON.stringify({
      name: fd.get("name"), category: fd.get("category"), city: fd.get("city"), website: fd.get("website"),
      interest: fd.get("interest"), objective: fd.get("objective"), score: Number(fd.get("score") || 0),
    }) });
    onUpdate(updated); setBusinessOpen(false); notify("Negocio registrado en la base");
  }
  return (
    <>
    <aside className={open ? "client-info open" : "client-info"}>
      <header>
        <h2>Información del cliente</h2>
        <button onClick={close}>×</button>
      </header>
      <div className="client-profile">
        <span className="contact-avatar large">
          {c.business.slice(0, 2).toUpperCase()}
        </span>
        <h3>{c.business}</h3>
        <p>{c.name}</p>
        <button className="register-business" onClick={() => setBusinessOpen(true)}>
          {c.business === "Sin negocio" ? "＋ Registrar negocio" : "Editar negocio"}
        </button>
        <span className="hot">🔥 Lead caliente</span>
      </div>
      <div
        className="score-ring"
        style={{ "--score": `${c.score * 3.6}deg` } as CSSProperties}
      >
        <div>
          <b>{c.score}</b>
          <small>/100</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>Interés</dt>
          <dd>{c.interest}</dd>
        </div>
        <div>
          <dt>Ciudad</dt>
          <dd>{c.city}</dd>
        </div>
        <div>
          <dt>Origen</dt>
          <dd>{c.source}</dd>
        </div>
        <div>
          <dt>Modo</dt>
          <dd>
            <em className={`mode ${c.agentMode.toLowerCase()}`}>
              {c.agentMode}
            </em>
          </dd>
        </div>
      </dl>
      <section>
        <small>OBJETIVO</small>
        <p>{c.objective}</p>
      </section>
      <section>
        <small>NOTAS INTERNAS</small>
        <p>{c.notes}</p>
      </section>
      <div className="timeline">
        <small>TIMELINE</small>
        <p>
          <i />
          Hoy · Cliente respondió
        </p>
        <p>
          <i />
          Hoy · Lead clasificado
        </p>
        <p>
          <i />
          Ayer · Primer contacto
        </p>
      </div>
      <button className="secondary-action">＋ Crear seguimiento</button>
    </aside>
    {businessOpen && <div className="modal-backdrop" onClick={() => setBusinessOpen(false)}>
      <form className="small-modal" onSubmit={registerBusiness} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={() => setBusinessOpen(false)}>×</button>
        <h2>{c.business === "Sin negocio" ? "Registrar negocio" : "Editar negocio"}</h2>
        <p className="modal-help">Quedará vinculado a {c.name} y a todo el historial de este chat.</p>
        <label>Nombre del negocio<input name="name" required defaultValue={c.business === "Sin negocio" ? "" : c.business} /></label>
        <label>Categoría<input name="category" defaultValue={c.category} /></label>
        <label>Ciudad<input name="city" defaultValue={c.city} /></label>
        <label>Sitio web<input name="website" placeholder="https://" /></label>
        <label>Interés<input name="interest" defaultValue={c.interest} /></label>
        <label>Objetivo<textarea name="objective" defaultValue={c.objective} /></label>
        <label>Score<input name="score" type="number" min="0" max="100" defaultValue={c.score} /></label>
        <button className="primary-action">Guardar negocio</button>
      </form>
    </div>}
    </>
  );
}
function Prospects({
  initial,
  outreach: initialOutreach,
  notify,
}: {
  initial: Prospect[];
  outreach: OutreachItem[];
  notify: (s: string) => void;
}) {
  const [selected, setSelected] = useState<Prospect | null>(null),
    [items, setItems] = useState(initial),
    [outreach, setOutreach] = useState(initialOutreach),
    [filter, setFilter] = useState("Todos"),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false);
  const shown = items.filter(
    (p) =>
      (filter === "Todos" ||
        (filter === "Alta prioridad" && p.score >= 85) ||
        (filter === "Nuevos" && p.status === "NEW") ||
        (filter === "Interesados" && p.status === "INTERESTED")) &&
      p.business.toLowerCase().includes(query.toLowerCase()),
  );
  async function approve(p: Prospect) {
    const item = await api(`outreach/${p.id}/approve`, {
      method: "POST",
      body: "{}",
    });
    setOutreach((x) => [item, ...x.filter((y) => y.id !== item.id)]);
    setItems((x) =>
      x.map((y) =>
        y.id === p.id ? { ...y, lastAction: "Mensaje aprobado" } : y,
      ),
    );
    setSelected(p);
    notify("Mensaje aprobado y agregado a la cola");
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form);
    const item = await api("prospects", { method: "POST", body: JSON.stringify({
      business: fd.get("business"), category: fd.get("category") || "", city: fd.get("city") || "",
      phone: fd.get("phone") || "", whatsapp: Boolean(fd.get("whatsapp")), web: "", instagram: "", facebook: "",
      score: Number(fd.get("score") || 0), opportunity: fd.get("opportunity") || "Por definir", status: "NEW",
      lastAction: "Creado manualmente", problems: [], suggestedMessage: "",
    }) });
    setItems((x) => [item, ...x]); setCreating(false); form.reset(); notify("Prospecto creado");
  }
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">INTELIGENCIA COMERCIAL</p>
          <h1>Prospectos</h1>
          <p>Oportunidades detectadas y priorizadas para contacto.</p>
        </div>
        <button onClick={() => setCreating(true)}>＋ Nuevo prospecto</button>
      </div>
      <div className="toolbar">
        <div className="chat-search">
          ⌕
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar negocio"
          />
        </div>
        <div className="filters">
          {["Todos", "Nuevos", "Alta prioridad", "Interesados"].map((x) => (
            <button
              className={filter === x ? "active" : ""}
              onClick={() => setFilter(x)}
              key={x}
            >
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Categoría / Ciudad</th>
              <th>Contacto</th>
              <th>Score</th>
              <th>Oportunidad</th>
              <th>Estado</th>
              <th>Última acción</th>
            </tr>
          </thead>
          <tbody>
            {shown
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <tr key={p.id} onClick={() => setSelected(p)}>
                  <td>
                    <b>{p.business}</b>
                    <small>{p.web || "Sin sitio web"}</small>
                  </td>
                  <td>
                    {p.category}
                    <small>{p.city}</small>
                  </td>
                  <td>
                    {p.phone}
                    <small>
                      {p.whatsapp ? "WhatsApp disponible" : "Sin WhatsApp"}
                    </small>
                  </td>
                  <td>
                    <span className="score">{p.score}</span>
                  </td>
                  <td>{p.opportunity}</td>
                  <td>
                    <em className={`status ${p.status.toLowerCase()}`}>
                      {p.status}
                    </em>
                  </td>
                  <td>
                    {p.lastAction}
                    <span className="row-arrow">→</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="outreach-panel">
        <PanelHead
          title="Outreach queue"
          subtitle="Cola segura de mensajes aprobados"
        />
        <div>
          {outreach.length ? (
            outreach.map((x) => (
              <p key={x.id}>
                <b>{x.prospect}</b>
                <span>{x.channel}</span>
                <em className="status approved">{x.status}</em>
              </p>
            ))
          ) : (
            <div className="empty">
              <span>⌁</span>
              <b>La cola está vacía</b>
              <small>
                Aprueba un mensaje desde el detalle de un prospecto.
              </small>
            </div>
          )}
        </div>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <article
            className="prospect-detail"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelected(null)}>
              ×
            </button>
            <p className="eyebrow">PERFIL DE OPORTUNIDAD</p>
            <h2>{selected.business}</h2>
            <p>
              {selected.category} · {selected.city} · {selected.phone}
            </p>
            <div className="detail-score">
              <b>{selected.score}</b>
              <span>
                / 100
                <br />
                POTENCIAL ALTO
              </span>
            </div>
            <section>
              <h3>Problemas detectados</h3>
              {selected.problems.map((x) => (
                <p className="problem" key={x}>
                  ✓ {x}
                </p>
              ))}
            </section>
            <section className="opportunity">
              <small>OPORTUNIDAD RECOMENDADA</small>
              <b>{selected.opportunity}</b>
            </section>
            <section>
              <h3>Mensaje sugerido</h3>
              <textarea defaultValue={selected.suggestedMessage} />
              <div className="modal-actions">
                <button className="ghost-action">Descartar</button>
                <button
                  className="primary-action"
                  onClick={() => approve(selected)}
                >
                  ✓ Aprobar mensaje
                </button>
              </div>
            </section>
          </article>
        </div>
      )}
      {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}>
        <form className="small-modal" onSubmit={create} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="modal-close" onClick={() => setCreating(false)}>×</button>
          <h2>Nuevo prospecto</h2>
          <label>Negocio<input name="business" required minLength={2} /></label>
          <label>Categoría<input name="category" /></label><label>Ciudad<input name="city" /></label>
          <label>Teléfono<input name="phone" /></label>
          <label><input name="whatsapp" type="checkbox" /> Tiene WhatsApp</label>
          <label>Score<input name="score" type="number" min="0" max="100" defaultValue="0" /></label>
          <label>Oportunidad<input name="opportunity" /></label>
          <button className="primary-action">Guardar prospecto</button>
        </form>
      </div>}
    </>
  );
}
function Leads({
  initial,
  notify,
}: {
  initial: Lead[];
  notify: (s: string) => void;
}) {
  const [items, setItems] = useState(initial), [creating, setCreating] = useState(false);
  async function move(id: string, stage: string) {
    const data = await api(`leads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
    setItems((x) => x.map((y) => (y.id === id ? data : y)));
    notify(`Lead movido a ${stageNames[stage]}`);
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form);
    const item = await api("leads", { method: "POST", body: JSON.stringify({
      business: fd.get("business"), contact: fd.get("contact") || "", value: Number(fd.get("value") || 0),
      score: Number(fd.get("score") || 0), stage: "NEW",
    }) });
    setItems((x) => [item, ...x]); setCreating(false); form.reset(); notify("Lead creado");
  }
  const stages = [
    "NEW",
    "CONTACTED",
    "REPLIED",
    "INTERESTED",
    "QUALIFIED",
    "QUOTE",
    "MEETING",
    "WON",
  ];
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">PIPELINE COMERCIAL</p>
          <h1>Leads</h1>
          <p>Del primer contacto al cierre, sin perder contexto.</p>
        </div>
        <button onClick={() => setCreating(true)}>＋ Nuevo lead</button>
      </div>
      <div className="kanban">
        {stages.map((stage) => (
          <section key={stage}>
            <header>
              <span>{stageNames[stage]}</span>
              <i>{items.filter((x) => x.stage === stage).length}</i>
            </header>
            {items
              .filter((x) => x.stage === stage)
              .map((l) => (
                <article key={l.id}>
                  <div>
                    <b>{l.business}</b>
                    <span className="score">{l.score}</span>
                  </div>
                  <p>{l.contact}</p>
                  <small>
                    ${l.value.toLocaleString()} · {l.lastActivity}
                  </small>
                  <select
                    value={l.stage}
                    onChange={(e) => move(l.id, e.target.value)}
                    aria-label={`Etapa de ${l.business}`}
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>
                        {stageNames[s]}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
          </section>
        ))}
      </div>
      {creating && <div className="modal-backdrop" onClick={() => setCreating(false)}><form className="small-modal" onSubmit={create} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={() => setCreating(false)}>×</button><h2>Nuevo lead</h2>
        <label>Negocio<input name="business" required /></label><label>Contacto<input name="contact" /></label>
        <label>Valor estimado<input name="value" type="number" min="0" defaultValue="0" /></label>
        <label>Score<input name="score" type="number" min="0" max="100" defaultValue="0" /></label>
        <button className="primary-action">Guardar lead</button></form></div>}
    </>
  );
}
function Quotes({ initial, notify }: { initial: Quote[]; notify: (s: string) => void }) {
  const [items, setItems] = useState(initial), [open, setOpen] = useState(false);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form);
    const item = await api("quotes", { method: "POST", body: JSON.stringify({
      client: fd.get("client"), business: fd.get("business"), service: fd.get("service"), scope: fd.get("scope"),
      notes: fd.get("notes") || "", estimatedPrice: Number(fd.get("estimatedPrice") || 0), status: "DRAFT",
    }) });
    setItems((x) => [item, ...x]); setOpen(false); form.reset(); notify("Cotización creada");
  }
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">PROPUESTAS</p>
          <h1>Cotizaciones</h1>
          <p>Alcances y decisiones comerciales en un solo lugar.</p>
        </div>
        <button onClick={() => setOpen(true)}>＋ Nueva cotización</button>
      </div>
      <CardTable
        headers={["Cliente", "Servicio", "Alcance", "Estimado", "Estado"]}
        rows={items.map((x) => [
          `${x.client}|${x.business}`,
          x.service,
          x.scope,
          `$${x.estimatedPrice.toLocaleString()}`,
          x.status,
        ])}
      />
      {open && <div className="modal-backdrop" onClick={() => setOpen(false)}><form className="small-modal" onSubmit={create} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={() => setOpen(false)}>×</button><h2>Nueva cotización</h2>
        <label>Cliente<input name="client" required /></label><label>Negocio<input name="business" required /></label>
        <label>Servicio<input name="service" required /></label><label>Alcance<textarea name="scope" required /></label>
        <label>Precio estimado<input name="estimatedPrice" type="number" min="0" required /></label><label>Notas<textarea name="notes" /></label>
        <button className="primary-action">Guardar cotización</button></form></div>}
    </>
  );
}
function Followups({
  initial,
  notify,
}: {
  initial: Followup[];
  notify: (s: string) => void;
}) {
  const [open, setOpen] = useState(false), [items, setItems] = useState(initial);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget, fd = new FormData(form);
    const item = await api("followups", { method: "POST", body: JSON.stringify({
      client: fd.get("client"), reason: fd.get("reason"), date: fd.get("date"), time: fd.get("time"),
      channel: fd.get("channel"), message: fd.get("message") || "", status: "PENDING",
    }) });
    setItems((x) => [...x, item]); setOpen(false); form.reset(); notify("Seguimiento programado");
  }
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">PRÓXIMAS ACCIONES</p>
          <h1>Seguimientos</h1>
          <p>La agenda comercial que mantiene cada oportunidad avanzando.</p>
        </div>
        <button onClick={() => setOpen(true)}>＋ Programar seguimiento</button>
      </div>
      <div className="followup-grid">
        {items.map((x) => (
          <article key={x.id}>
            <time>
              <b>{x.time}</b>
              <small>{x.date}</small>
            </time>
            <div>
              <span className="status today">{x.status}</span>
              <h3>{x.client}</h3>
              <p>{x.reason}</p>
              <small>
                {x.channel} · {x.message}
              </small>
            </div>
            <button>•••</button>
          </article>
        ))}
      </div>
      {open && (
        <div className="modal-backdrop">
          <form
            className="small-modal"
            onSubmit={create}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <h2>Programar seguimiento</h2>
            <label>
              Cliente
              <input name="client" required />
            </label>
            <label>
              Motivo
              <input name="reason" required />
            </label>
            <div className="field-pair">
              <label>
                Fecha
                <input name="date" type="date" required />
              </label>
              <label>
                Hora
                <input name="time" type="time" required />
              </label>
            </div>
            <label>Canal<select name="channel" defaultValue="WhatsApp"><option>WhatsApp</option><option>Llamada</option><option>Email</option></select></label>
            <label>Mensaje<textarea name="message" /></label>
            <button className="primary-action">Guardar seguimiento</button>
          </form>
        </div>
      )}
    </>
  );
}
function Agent({ data, toggle }: { data: AgentData; toggle: () => void }) {
  const [settings, setSettings] = useState({
    sessionTimeoutMinutes: Number(data.settings.closeMinutes),
    reminderMinutes: Number(data.settings.reminderMinutes),
    autoReply: Boolean(data.settings.autoReply),
    aiFallback: Boolean(data.settings.aiFallback),
    outOfHoursEnabled: Boolean(data.settings.afterHours),
  });
  async function save(patch: Partial<typeof settings>) {
    const updated = await api("agent/settings", {
      method: "PATCH",
      body: JSON.stringify({ ...settings, ...patch }),
    });
    setSettings({
      sessionTimeoutMinutes: updated.settings.closeMinutes,
      reminderMinutes: updated.settings.reminderMinutes,
      autoReply: updated.settings.autoReply,
      aiFallback: updated.settings.aiFallback,
      outOfHoursEnabled: updated.settings.afterHours,
    });
  }
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">CENTRO DE OPERACIONES IA</p>
          <h1>Agente Boza</h1>
          <p>Supervisión del agente de WhatsApp y sus sesiones.</p>
        </div>
        <button className={data.online ? "danger-button" : ""} onClick={toggle}>
          {data.online ? "Ⅱ Pausar agente" : "▶ Reanudar agente"}
        </button>
      </div>
      <div className="agent-hero">
        <div className="agent-orb big">
          <span>✦</span>
        </div>
        <div>
          <span className={`agent-state ${data.online ? "online" : "paused"}`}>
            <i />
            {data.online ? "ONLINE" : "PAUSADO"}
          </span>
          <h2>Agente Boza</h2>
          <p>
            {data.online
              ? "Respondiendo y clasificando conversaciones en tiempo real."
              : "Las respuestas automáticas están detenidas."}
          </p>
        </div>
        <div className="agent-stack">
          <span>
            Modelo <b>{data.model}</b>
          </span>
          <span>
            WhatsApp <b>{data.provider}</b>
          </span>
        </div>
      </div>
      <div className="agent-metrics">
        {[
          ["Sesiones activas", data.activeSessions],
          ["Mensajes procesados", data.messagesProcessed],
          ["Fallbacks IA", data.fallbacks],
          ["Chats humanos", data.humanChats],
        ].map((x) => (
          <article key={String(x[0])}>
            <small>{x[0]}</small>
            <b>{x[1]}</b>
          </article>
        ))}
      </div>
      <div className="settings-grid">
        <article className="panel">
          <PanelHead
            title="Comportamiento"
            subtitle="Configuración preparada para sincronizar"
          />
          <Setting
            name="Tiempo de cierre"
            value={`${settings.sessionTimeoutMinutes} min`}
          />
          <Setting
            name="Recordatorio"
            value={`${settings.reminderMinutes} min`}
          />
          <Setting
            name="Auto responder"
            toggle
            enabled={settings.autoReply}
            onToggle={() => save({ autoReply: !settings.autoReply })}
          />
          <Setting
            name="Fallback IA"
            toggle
            enabled={settings.aiFallback}
            onToggle={() => save({ aiFallback: !settings.aiFallback })}
          />
          <Setting
            name="Modo fuera de horario"
            toggle
            enabled={settings.outOfHoursEnabled}
            onToggle={() =>
              save({ outOfHoursEnabled: !settings.outOfHoursEnabled })
            }
          />
        </article>
        <article className="panel danger-zone">
          <PanelHead
            title="Controles operativos"
            subtitle="Acciones sobre sesiones y memoria"
          />
          <button
            onClick={() => confirm("¿Cerrar todas las sesiones activas?")}
          >
            Cerrar sesiones activas <span>→</span>
          </button>
          <button
            onClick={() => confirm("¿Limpiar la memoria temporal del agente?")}
          >
            Limpiar memoria temporal <span>→</span>
          </button>
        </article>
      </div>
    </>
  );
}
function Automations() {
  const flows = [
    [
      "Agente WhatsApp",
      "Clasifica y responde conversaciones",
      "ACTIVO",
      "Hace 2 min",
    ],
    [
      "Seguimiento de leads",
      "Programa recordatorios por intención",
      "ACTIVO",
      "Hace 18 min",
    ],
    ["Prospección", "Prepara mensajes para revisión", "PAUSADO", "Ayer"],
    ["Recordatorios", "Notifica tareas próximas", "ACTIVO", "Hace 7 min"],
    ["Cotizaciones", "Actualiza estados de propuestas", "ACTIVO", "Hace 1 h"],
    ["Limpieza de sesiones", "Cierra sesiones inactivas", "ERROR", "Hace 3 h"],
  ];
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">WORKFLOWS</p>
          <h1>Automatizaciones</h1>
          <p>Procesos conectados, observables y bajo control.</p>
        </div>
        <button>＋ Nuevo workflow</button>
      </div>
      <div className="workflow-grid">
        {flows.map((x, i) => (
          <article key={x[0]}>
            <span className="workflow-icon">
              {["✦", "↗", "◎", "◷", "▤", "⌁"][i]}
            </span>
            <em className={`status ${x[2].toLowerCase()}`}>{x[2]}</em>
            <h2>{x[0]}</h2>
            <p>{x[1]}</p>
            <footer>
              <small>Última ejecución</small>
              <b>{x[3]}</b>
              <button>•••</button>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
function Settings() {
  const [health, setHealth] = useState<Record<string, unknown>>({});
  useEffect(() => {
    api("system/health")
      .then(setHealth)
      .catch(() => setHealth({ database: "error" }));
  }, []);
  const status = (key: string, fallback: string) =>
    typeof health[key] === "string"
      ? health[key]
          .replace("unconfigured", "No configurado")
          .replace("configured", "Configurado")
          .replace("connected", "Conectado")
          .replace("error", "Error")
      : fallback;
  const whatsapp = health.whatsapp as
    | { provider?: string; configured?: boolean; status?: string }
    | undefined;
  const whatsappStatus = !whatsapp
    ? "Comprobando"
    : !whatsapp.configured
      ? "No configurado"
      : whatsapp.status === "authorized"
        ? "Conectado"
        : whatsapp.status === "error"
          ? "Error"
          : whatsapp.status || "Configurado";
  return (
    <>
      <div className="module-head">
        <div>
          <p className="eyebrow">PREFERENCIAS</p>
          <h1>Configuración</h1>
          <p>Conexiones y comportamiento del Control Center.</p>
        </div>
      </div>
      <div className="settings-list">
        {[
          ["General", "Identidad, zona horaria y preferencias", "Configurado"],
          ["Agente", "Modelo y comportamiento automático", "Configurado"],
          [
            "WhatsApp",
            "Proveedor GREEN-API · Instancia 710722757947",
            whatsappStatus,
          ],
          [
            "OpenRouter",
            "Proveedor de inteligencia artificial",
            status("openrouter", "Comprobando"),
          ],
          ["n8n", "Workflows y webhooks", status("n8n", "Comprobando")],
          ["Seguridad", "Sesión, contraseña y acceso", "Configurado"],
          [
            "PWA",
            `Instalación · Base de datos ${status("database", "comprobando")}`,
            "Disponible",
          ],
        ].map((x, i) => (
          <article key={x[0]}>
            <span>{["⚙", "✦", "◫", "◇", "⌁", "▣", "▱"][i]}</span>
            <div>
              <b>{x[0]}</b>
              <small>{x[1]}</small>
            </div>
            <em className={x[2] === "No configurado" ? "not-configured" : ""}>
              {x[2]}
            </em>
            <button>→</button>
          </article>
        ))}
      </div>
      <p className="secret-note">
        Los secretos nunca se muestran en esta interfaz. Se administran
        únicamente mediante variables de entorno del servidor.
      </p>
    </>
  );
}
function CardTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((x) => (
              <th key={x}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((x, j) => (
                <td key={j}>
                  {x.includes("|") ? (
                    <>
                      {x.split("|")[0]}
                      <small>{x.split("|")[1]}</small>
                    </>
                  ) : j === r.length - 1 ? (
                    <em className="status approved">{x}</em>
                  ) : (
                    x
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Setting({
  name,
  value,
  toggle,
  enabled,
  onToggle,
}: {
  name: string;
  value?: string;
  toggle?: boolean;
  enabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="setting">
      <span>{name}</span>
      {toggle ? (
        <button
          onClick={onToggle}
          className={enabled ? "switch on" : "switch"}
          aria-pressed={enabled}
        >
          <i />
        </button>
      ) : (
        <b>{value}</b>
      )}
    </div>
  );
}
function Notifications() {
  return (
    <div className="notifications">
      <header>
        <b>Notificaciones</b>
        <button>Marcar leídas</button>
      </header>
      <div>
        <p>
          <b>No hay notificaciones nuevas</b>
          <small>Los eventos reales aparecerán aquí.</small>
        </p>
      </div>
    </div>
  );
}
function CommandPalette({
  go,
  close,
  toggleAgent,
}: {
  go: (v: View) => void;
  close: () => void;
  toggleAgent: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="command" onClick={(e) => e.stopPropagation()}>
        <input autoFocus placeholder="Escribe un comando o busca…" />
        {[
          ["⌂", "Ir al Dashboard", "dashboard"],
          ["◫", "Abrir conversaciones", "conversations"],
          ["◎", "Buscar prospecto", "prospects"],
          ["◇", "Ir a leads", "leads"],
        ].map((x) => (
          <button key={x[1]} onClick={() => go(x[2] as View)}>
            <span>{x[0]}</span>
            {x[1]}
            <kbd>↵</kbd>
          </button>
        ))}
        <button
          onClick={() => {
            toggleAgent();
            close();
          }}
        >
          <span>Ⅱ</span>Pausar / reanudar agente
        </button>
      </div>
    </div>
  );
}
