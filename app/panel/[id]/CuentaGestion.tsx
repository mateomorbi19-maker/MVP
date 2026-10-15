'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CuentaPoliza } from '@/app/components/CuentaPoliza'
import type { EstadoCuenta } from '@/lib/polizas'

export function CuentaGestion({ poliza }: { poliza: { id: string; numero: string; aseguradora: string; estado_cuenta: EstadoCuenta | null } }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  return <section className="tarjeta">
    <h2 className="titulo-tarjeta">Póliza del asegurado: {poliza.aseguradora} · {poliza.numero}</h2>
    <p className="mini">La carga queda registrada con tu cuenta y tu rol. No altera el expediente de esta actuación.</p>
    {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
    <CuentaPoliza poliza={poliza} alCambiar={() => router.refresh()} alFallar={setError} />
  </section>
}
