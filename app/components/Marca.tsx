import Link from 'next/link'
import { Icono } from './Iconos'

export function Marca({ enlace = true, sub }: { enlace?: boolean; sub?: string }) {
  const contenido = (
    <>
      <div className="marca-punto">
        <Icono nombre="escudo" />
      </div>
      <div className="marca-contenido">
        <div className="marca-texto">Accidente Certificado</div>
        {sub ? <div className="marca-sub">{sub}</div> : null}
      </div>
    </>
  )

  if (!enlace) return <div className="marca">{contenido}</div>

  return (
    <Link href="/" className="marca marca-enlace">
      {contenido}
    </Link>
  )
}
