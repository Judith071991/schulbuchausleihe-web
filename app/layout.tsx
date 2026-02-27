import './globals.css';

export const metadata = { title: 'Schulbuchausleihe' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
