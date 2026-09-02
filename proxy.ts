import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Evita pintar una pantalla privada cuando no hay ni siquiera una cookie de sesión.
 *
 * OJO CON LO QUE ESTO NO ES: no es control de acceso. Los docs de Next 16 lo dicen
 * explícitamente —el proxy corre antes de renderizar, está pensado para redirecciones y
 * reescrituras, y no debe apoyarse en módulos compartidos ni en estado global—. Acá sólo
 * se mira si la cookie existe; que sea válida, que no haya vencido y que el rol alcance
 * lo resuelve exigirRol() en la capa de datos, que es donde vale.
 *
 * Sin esto igual estaría todo protegido: esto sólo evita el parpadeo de una pantalla que
 * después va a devolver 401 de todos modos.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has('acta_sesion')) return NextResponse.next()

  const destino = new URL('/entrar', request.url)
  destino.searchParams.set('volver', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: ['/panel/:path*', '/cuenta/:path*'],
}
