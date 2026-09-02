import { createConnection, type Socket } from 'node:net'
import { connect as conectarTls, type TLSSocket } from 'node:tls'

/**
 * Cliente SMTP mínimo, sin dependencias.
 *
 * Es la misma clase de trabajo que la solicitud DER de sello de tiempo hecha a mano en
 * lib/sello.ts, y por el mismo motivo: el proyecto tiene seis dependencias y es
 * deliberado. nodemailer arrastra un árbol grande para un caso —mandar un aviso con un
 * enlace— que son doscientas líneas de protocolo.
 *
 * QUÉ NO HACE, para que nadie se sorprenda: no implementa XOAUTH2, así que Gmail necesita
 * una clave de aplicación o un relay; no mantiene un pool de conexiones; y los errores
 * exóticos de un relay corporativo los traducimos nosotros. Si el comprador impone un
 * servidor con un mecanismo de autenticación que no está acá, se instala nodemailer: todo
 * esto vive detrás de enviarCorreo() y el cambio toca un solo archivo.
 */

export class ErrorCorreo extends Error {
  constructor(
    mensaje: string,
    readonly configuracion = false,
  ) {
    super(mensaje)
    this.name = 'ErrorCorreo'
  }
}

export interface ConfiguracionCorreo {
  host: string
  puerto: number
  usuario: string | null
  clave: string | null
  remitente: string
  /** true = TLS desde el saludo (465). false = STARTTLS (587). */
  tlsDirecto: boolean
}

/** Qué falta para poder mandar un correo. null si está todo. */
export function configuracionCorreo(): ConfiguracionCorreo | null {
  const host = process.env.SMTP_HOST
  const remitente = process.env.SMTP_REMITENTE
  if (!host || !remitente) return null
  const puerto = Number(process.env.SMTP_PUERTO || 587)
  return {
    host,
    puerto,
    usuario: process.env.SMTP_USUARIO || null,
    clave: process.env.SMTP_CLAVE || null,
    remitente,
    tlsDirecto: process.env.SMTP_TLS === 'directo' || puerto === 465,
  }
}

/** El detalle accionable de qué falta, con el mismo criterio que /api/salud usa con la base. */
export function faltaParaCorreo(): string | null {
  if (!process.env.SMTP_HOST) return 'Falta SMTP_HOST: no hay servidor de correo configurado.'
  if (!process.env.SMTP_REMITENTE) return 'Falta SMTP_REMITENTE: no hay dirección desde la cual enviar.'
  return null
}

type Conexion = Socket | TLSSocket

/** Lee una respuesta SMTP completa (varias líneas terminan con "250 " y no "250-"). */
function leerRespuesta(socket: Conexion, esperado: number[]): Promise<string> {
  return new Promise((resolver, rechazar) => {
    let acumulado = ''
    const alDato = (trozo: Buffer) => {
      acumulado += trozo.toString('utf8')
      const lineas = acumulado.split('\r\n').filter(Boolean)
      const ultima = lineas[lineas.length - 1]
      if (!ultima || !/^\d{3} /.test(ultima)) return
      limpiar()
      const codigo = Number(ultima.slice(0, 3))
      if (!esperado.includes(codigo)) {
        rechazar(new ErrorCorreo(`El servidor de correo respondió ${ultima.trim()}`))
        return
      }
      resolver(acumulado)
    }
    const alError = (err: Error) => {
      limpiar()
      rechazar(new ErrorCorreo(`No se pudo hablar con el servidor de correo: ${err.message}`))
    }
    const limpiar = () => {
      socket.off('data', alDato)
      socket.off('error', alError)
    }
    socket.on('data', alDato)
    socket.on('error', alError)
  })
}

function escribir(socket: Conexion, linea: string): void {
  socket.write(linea + '\r\n')
}

async function decir(socket: Conexion, linea: string, esperado: number[]): Promise<string> {
  const respuesta = leerRespuesta(socket, esperado)
  escribir(socket, linea)
  return respuesta
}

export interface Mensaje {
  para: string
  asunto: string
  /** Texto plano. No se manda HTML: un aviso con un enlace no lo necesita. */
  cuerpo: string
}

/**
 * Codifica una cabecera con acentos, RFC 2047.
 *
 * Sin esto un asunto con «actuación» llega ilegible en la mitad de los clientes.
 */
const cabecera = (valor: string): string =>
  /^[\x20-\x7e]*$/.test(valor) ? valor : `=?UTF-8?B?${Buffer.from(valor, 'utf8').toString('base64')}?=`

/** El cuerpo va en base64: evita por completo el problema de las líneas largas y el punto solo. */
function cuerpoCodificado(texto: string): string {
  const b64 = Buffer.from(texto, 'utf8').toString('base64')
  return (b64.match(/.{1,76}/g) ?? []).join('\r\n')
}

/**
 * Manda un correo.
 *
 * Único punto de salida: cambiar de proveedor o pasar a nodemailer toca sólo esta función.
 */
export async function enviarCorreo(mensaje: Mensaje): Promise<void> {
  const cfg = configuracionCorreo()
  if (!cfg) throw new ErrorCorreo(faltaParaCorreo() ?? 'Correo sin configurar.', true)

  const socketInicial: Conexion = cfg.tlsDirecto
    ? conectarTls({ host: cfg.host, port: cfg.puerto, servername: cfg.host })
    : createConnection({ host: cfg.host, port: cfg.puerto })

  let socket = socketInicial
  const cerrar = () => {
    try {
      socket.destroy()
    } catch {
      /* ya estaba cerrado */
    }
  }

  const tiempo = setTimeout(() => cerrar(), 20_000)

  try {
    await new Promise<void>((resolver, rechazar) => {
      socket.once(cfg.tlsDirecto ? 'secureConnect' : 'connect', () => resolver())
      socket.once('error', (err) =>
        rechazar(
          new ErrorCorreo(
            `No se pudo conectar con ${cfg.host}:${cfg.puerto}. Revisá SMTP_HOST y SMTP_PUERTO, y que el servicio pueda salir a ese puerto. (${err.message})`,
          ),
        ),
      )
    })

    await leerRespuesta(socket, [220])
    await decir(socket, 'EHLO acta-digital', [250])

    if (!cfg.tlsDirecto) {
      await decir(socket, 'STARTTLS', [220])
      socket = conectarTls({ socket: socketInicial, servername: cfg.host })
      await new Promise<void>((resolver, rechazar) => {
        ;(socket as TLSSocket).once('secureConnect', () => resolver())
        socket.once('error', (err) => rechazar(new ErrorCorreo(`Falló el cifrado con el servidor: ${err.message}`)))
      })
      await decir(socket, 'EHLO acta-digital', [250])
    }

    if (cfg.usuario && cfg.clave) {
      // AUTH LOGIN: el más compatible. Usuario y clave van en base64, uno por vez.
      await decir(socket, 'AUTH LOGIN', [334])
      await decir(socket, Buffer.from(cfg.usuario, 'utf8').toString('base64'), [334])
      await decir(socket, Buffer.from(cfg.clave, 'utf8').toString('base64'), [235])
    }

    await decir(socket, `MAIL FROM:<${cfg.remitente}>`, [250])
    await decir(socket, `RCPT TO:<${mensaje.para}>`, [250, 251])
    await decir(socket, 'DATA', [354])

    const cuerpo = [
      `From: ${cfg.remitente}`,
      `To: ${mensaje.para}`,
      `Subject: ${cabecera(mensaje.asunto)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      cuerpoCodificado(mensaje.cuerpo),
      '.',
    ].join('\r\n')

    const fin = leerRespuesta(socket, [250])
    socket.write(cuerpo + '\r\n')
    await fin

    await decir(socket, 'QUIT', [221]).catch(() => undefined)
  } finally {
    clearTimeout(tiempo)
    cerrar()
  }
}
