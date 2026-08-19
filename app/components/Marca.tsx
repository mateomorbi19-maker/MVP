import Link from 'next/link'

export function Marca({ enlace = true, sub }: { enlace?: boolean; sub?: string }) {
  const contenido = (
    <>
      <div className="marca-punto">AD</div>
      <div>
        <div className="marca-texto">Acta Digital de Siniestro</div>
        {sub ? <div className="marca-sub">{sub}</div> : null}
      </div>
    </>
  )

  if (!enlace) return <div className="marca">{contenido}</div>

  return (
    <Link href="/" className="marca" style={{ color: 'inherit', textDecoration: 'none' }}>
      {contenido}
    </Link>
  )
}
