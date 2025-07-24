import "@/styles/globals.css";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-white text-stone-700">
        {children}
      </body>
    </html>
  );
}