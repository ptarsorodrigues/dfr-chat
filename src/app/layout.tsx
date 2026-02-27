import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DFR CHAT — Sistema de Mensagens Corporativas",
  description: "Sistema profissional de mensagens internas para clínica odontológica",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
