import type { Metadata } from "next"
import { Inter, Michroma, Rajdhani, Share_Tech_Mono } from "next/font/google"

import "./globals.css"
import { EfectosHud } from "@/components/hud/efectos-hud"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** Texto corrido y formularios: sans serif de máxima legibilidad. */
const fontSans = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
})

/** Identidad Stark Industries: logotipo, encabezados y títulos de sección. */
const fontHud = Michroma({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-hud",
})

/** Datos y métricas (JARVIS): Rajdhani Light, Regular y Medium. */
const fontNum = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-num",
})

/** Datos técnicos, códigos y etiquetas: Share Tech Mono. */
const fontMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "NIMBUS · Centro de control ETL meteorológico",
  description:
    "Práctica de Big Data: extracción, transformación, limpieza, filtrado y carga de datos de Open-Meteo en Supabase.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        fontHud.variable,
        fontNum.variable,
        "font-sans",
        fontSans.variable
      )}
    >
      <body className="hud-fondo min-h-svh">
        {/* Luces de ambiente que se ven desenfocadas a través de los paneles de cristal */}
        <div className="hud-orbes" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        {/* Progreso de scroll (CSS puro) y microinteracciones globales */}
        <div className="hud-progreso" aria-hidden />
        <EfectosHud />
        {/* La interfaz HUD está diseñada solo en oscuro. */}
        <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  )
}
