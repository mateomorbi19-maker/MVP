type NombreIcono =
  | 'archivo'
  | 'personas'
  | 'camara'
  | 'compartir'
  | 'descargar'
  | 'escudo'
  | 'microfono'
  | 'telefono'
  | 'tilde'
  | 'ubicacion'
  | 'verificar'

export function Icono({ nombre, clase = 'icono' }: { nombre: NombreIcono; clase?: string }) {
  return (
    <svg
      className={clase}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {nombre === 'personas' ? (
        <>
          <path d="M15.5 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" />
          <circle cx="9.25" cy="7.6" r="3.1" />
          <path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3" />
          <path d="M15.8 4.7a3.4 3.4 0 0 1 0 6.4" />
        </>
      ) : null}

      {nombre === 'escudo' ? (
        <>
          <path d="M12 3 19 6v5c0 4.6-2.8 7.8-7 10-4.2-2.2-7-5.4-7-10V6l7-3Z" />
          <path d="m8.7 11.8 2.1 2.1 4.7-5" />
        </>
      ) : null}
      {nombre === 'tilde' ? <path d="m5 12.5 4.2 4.1L19 7" /> : null}
      {nombre === 'telefono' ? (
        <path d="M8.2 4.5 6.5 3.8c-.8-.3-1.7.1-2 .9l-.8 2.1c-.2.6-.1 1.3.2 1.9 2.3 4.8 6.1 8.6 10.9 10.9.6.3 1.3.4 1.9.2l2.1-.8c.8-.3 1.2-1.2.9-2l-.7-1.7c-.3-.8-1.2-1.2-2-.9l-1.8.6a2 2 0 0 1-2-.4l-3.8-3.8a2 2 0 0 1-.4-2l.6-1.8c.3-.8-.1-1.7-.9-2Z" />
      ) : null}
      {nombre === 'camara' ? (
        <>
          <path d="M4 7.5h3l1.4-2h7.2l1.4 2h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
          <circle cx="12" cy="13" r="3.5" />
        </>
      ) : null}
      {nombre === 'microfono' ? (
        <>
          <rect x="8.5" y={3} width="7" height="12" rx="3.5" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
        </>
      ) : null}
      {nombre === 'archivo' ? (
        <>
          <path d="M6 2.8h8l4 4V21H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z" />
          <path d="M14 2.8v4h4M8 12h6M8 16h8" />
        </>
      ) : null}
      {nombre === 'descargar' ? (
        <>
          <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
          <path d="M5 19v2h14v-2" />
        </>
      ) : null}
      {nombre === 'compartir' ? (
        <>
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5" />
        </>
      ) : null}
      {nombre === 'ubicacion' ? (
        <>
          <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" />
          <circle cx="12" cy="10" r="2.2" />
        </>
      ) : null}
      {nombre === 'verificar' ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5M7.8 10.7l1.8 1.8 3.8-4" />
        </>
      ) : null}
    </svg>
  )
}
