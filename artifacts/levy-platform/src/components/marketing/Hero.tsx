import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative overflow-hidden py-12 md:py-20">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="w-full h-full opacity-30 radial-glow" />
      </div>

      <div className="container-max mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl text-center mx-auto"
        >
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="text-hero font-extrabold text-foreground"
          >
            Premium, modern collections software for law firms
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="mt-6 text-body-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Lean, secure, and crafted for legal teams — manage levies, matters and collections with clarity.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-8 flex items-center justify-center gap-4"
          >
            <Button className="btn-ghost-interaction px-6 py-3 bg-primary text-primary-foreground shadow-sm" >Get Started</Button>
            <Button variant="ghost" className="btn-ghost-interaction px-6 py-3">Learn More</Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
