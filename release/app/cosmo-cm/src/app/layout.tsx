import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cosmo CM | Marketing IA",
  description: "Plataforma inteligente de generación y administración de contenido para redes sociales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-background text-foreground overflow-hidden`}>
        <div className="flex h-screen bg-[#050505] relative overflow-hidden">
          {/* Background Effects */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]"></div>
            <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[60%] rounded-full bg-accent/10 blur-[120px]"></div>
          </div>
          
          <Sidebar />
          
          <main className="flex-1 relative overflow-y-auto bg-black/20 backdrop-blur-3xl z-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
