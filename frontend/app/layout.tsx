import type { Metadata } from "next";
import AiChatWidget from "./ai-chat-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "Project management and kanban workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <AiChatWidget />
      </body>
    </html>
  );
}
