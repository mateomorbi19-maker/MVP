import { notFound } from 'next/navigation'
import { obtenerCaso, listarMedias, listarTestigos } from '@/lib/casos'
import { Flujo } from './Flujo'

export const dynamic = 'force-dynamic'

export default async function PaginaSiniestro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caso = await obtenerCaso(id)
  if (!caso) notFound()

  const [medias, testigos] = await Promise.all([listarMedias(id), listarTestigos(id)])

  return (
    <Flujo
      casoId={caso.id}
      estadoInicial={caso.estado}
      respuestasIniciales={caso.respuestas}
      hashMaestro={caso.hash_maestro}
      mediasIniciales={medias.map((m) => ({ id: m.id, tipo: m.tipo, guia_id: m.guia_id }))}
      testigosIniciales={testigos.map((t) => ({ id: t.id, nombre: t.nombre }))}
      ubicacionInicial={caso.gps ? { lat: caso.gps.lat, lon: caso.gps.lon, direccion: caso.direccion } : null}
    />
  )
}
