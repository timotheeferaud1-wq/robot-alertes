import "./globals.css";

export const metadata = { title: "Robot d'alertes", description: "Mes signaux de marché quotidiens" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
