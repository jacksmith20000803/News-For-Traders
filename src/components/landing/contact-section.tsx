"use client";

import { motion } from "framer-motion";
import { Mail, MessageSquare, MapPin, Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export function ContactSection() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = theme === "system" ? (resolvedTheme ?? "dark") : (theme ?? "dark");

  const bgColor = "landing-section-surface";
  const cardBg = currentTheme === "dark" ? "bg-[#0a0c0c]" : "bg-white";
  const textColor = currentTheme === "dark" ? "text-white" : "text-gray-900";
  const secondaryTextColor = currentTheme === "dark" ? "text-gray-400" : "text-gray-600";
  const gridColor = currentTheme === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.05)";
  const borderColor = currentTheme === "dark" ? "border-white/6" : "border-gray-200";
  const hoverBorderColor = currentTheme === "dark" ? "hover:border-white/10" : "hover:border-gray-300";
  const inputBg = currentTheme === "dark" ? "bg-white/5" : "bg-gray-100";
  const inputBorder = currentTheme === "dark" ? "border-white/10" : "border-gray-300";
  const inputText = currentTheme === "dark" ? "text-white" : "text-gray-900";
  const inputPlaceholder = currentTheme === "dark" ? "placeholder:text-gray-500" : "placeholder:text-gray-400";
  const focusBorder = currentTheme === "dark" ? "focus:border-emerald-500/50" : "focus:border-emerald-500/50";

  return (
    <section className={cn("relative py-20", bgColor)} suppressHydrationWarning>
      <div className="absolute inset-0" suppressHydrationWarning>
        <div
          className="absolute inset-0"
          suppressHydrationWarning
          style={{
            backgroundImage: `
              linear-gradient(${gridColor} 1px, transparent 1px),
              linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1800px] px-4 sm:px-6" suppressHydrationWarning>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-12"
        >
          <h2 className={cn("text-3xl sm:text-4xl font-bold mb-4", textColor)}>Get in Touch</h2>
          <p className={cn("text-lg max-w-2xl mx-auto", secondaryTextColor)}>
            Have questions? We are here to help. Reach out to our team for support, feedback, or partnerships.
          </p>
        </motion.div>

        <div className="flex gap-8 sm:gap-12 md:justify-around mb-12" suppressHydrationWarning>
          {[
            {
              icon: Mail,
              title: "Email Us",
              description: "cartoonverseytvid@gmail.com",
              href: "mailto:cartoonverseytvid@gmail.com",
            },
            {
              icon: MessageSquare,
              title: "Live Chat(Telegram)",
              description: "weasel_333, mortenblake1006",
              href: "https://t.me/weasel_333",
            },
            {
              icon: MapPin,
              title: "Visit Us",
              description: "San Francisco, CA",
              href: "#",
            },
          ].map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <ButtonLink
                href={item.href}
                className={cn("h-full p-6 rounded-2xl border transition-colors text-left", cardBg, borderColor, hoverBorderColor)}
              >
                <div className="flex items-start gap-4" suppressHydrationWarning>
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-emerald-500/10 shrink-0">
                    <item.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div suppressHydrationWarning>
                    <h3 className={cn("text-lg font-semibold mb-2", textColor)}>{item.title}</h3>
                    <p className={cn("text-sm", secondaryTextColor)}>{item.description}</p>
                    {item.title === "Email Us" && (
                      <p className={cn("text-sm mt-1", secondaryTextColor)}>smark.work.me@gmail.com</p>
                    )}
                  </div>
                </div>
              </ButtonLink>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="max-w-2xl mx-auto"
          suppressHydrationWarning
        >
          <div className={cn("p-8 rounded-2xl border", cardBg, borderColor)} suppressHydrationWarning>
            <h3 className={cn("text-xl font-semibold mb-6", textColor)}>Send us a message</h3>
            <form className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2" suppressHydrationWarning>
                <div suppressHydrationWarning>
                  <label htmlFor="name" className={cn("block text-sm font-medium mb-2", secondaryTextColor)}>
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className={cn("w-full px-4 py-3 rounded-lg border focus:outline-none transition-colors", inputBg, inputBorder, inputText, inputPlaceholder, focusBorder)}
                  />
                </div>
                <div suppressHydrationWarning>
                  <label htmlFor="email" className={cn("block text-sm font-medium mb-2", secondaryTextColor)}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    className={cn("w-full px-4 py-3 rounded-lg border focus:outline-none transition-colors", inputBg, inputBorder, inputText, inputPlaceholder, focusBorder)}
                  />
                </div>
              </div>
              <div suppressHydrationWarning>
                <label htmlFor="message" className={cn("block text-sm font-medium mb-2", secondaryTextColor)}>
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="How can we help you?"
                  className={cn("w-full px-4 py-3 rounded-lg border focus:outline-none transition-colors resize-none", inputBg, inputBorder, inputText, inputPlaceholder, focusBorder)}
                />
              </div>
              <ButtonLink
                href="/support"
                className="w-full flex items-center justify-center gap-2 px-8 py-4 text-base font-medium bg-gradient-to-r from-emerald-500 to-emerald-600 text-white dark:text-gray-900"
              >
                Send Message
                <Send className="w-4 h-4" />
              </ButtonLink>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
