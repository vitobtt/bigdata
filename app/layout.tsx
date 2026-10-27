import type { Metadata } from "next"
import { Exo_2, Geist_Mono, Orbitron } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

const fontSans = Exo_2({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
})

/** Tipografía de los títulos del HUD. */
const fontHud = Orbitron({ subsets: ["latin"], variable: "--font-hud" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
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
        {/* La interfaz HUD está diseñada solo en oscuro. */}
        <ThemeProvider forcedTheme="dark">{children}</ThemeProvider>
      </body>
    </html>
  )
}
