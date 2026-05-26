import React from "react";
import { motion } from "motion/react";
import {
  Palette,
  Type,
  LayoutGrid,
  Hand,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Chip } from "./ui/chip";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "./ui/card";

export function DesignSystem() {
  return (
    <div className="flex-1 container mx-auto px-4 py-8 lg:py-16">
      <div className="max-w-5xl mx-auto space-y-16">
        <header>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-heading text-white uppercase tracking-wide mb-4">
              Design System
            </h1>
            <p className="text-[#9CA3AF] text-xl max-w-2xl">
              CinemaX UI Kit - The foundational elements that
              power our cinematic ticket booking experience.
            </p>
          </motion.div>
        </header>

        {/* Colors */}
        <section className="space-y-6">
          <h2 className="text-2xl font-heading text-[#FFC857] uppercase tracking-widest flex items-center gap-3 border-b border-[#F5F5F7]/10 pb-4">
            <Palette className="w-6 h-6" /> Colors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <ColorSwatch
              name="Primary Red"
              hex="#E50914"
              className="bg-[#E50914]"
            />
            <ColorSwatch
              name="Deep Black"
              hex="#0B0B0D"
              className="bg-[#0B0B0D] border border-[#F5F5F7]/10"
            />
            <ColorSwatch
              name="Charcoal"
              hex="#1A1A1F"
              className="bg-[#1A1A1F] border border-[#F5F5F7]/10"
            />
            <ColorSwatch
              name="Light Surface"
              hex="#F5F5F7"
              className="bg-[#F5F5F7] text-black"
            />
            <ColorSwatch
              name="Accent"
              hex="#FFC857"
              className="bg-[#FFC857] text-black"
            />
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="text-2xl font-heading text-[#FFC857] uppercase tracking-widest flex items-center gap-3 border-b border-[#F5F5F7]/10 pb-4">
            <Type className="w-6 h-6" /> Typography
          </h2>
          <Card className="bg-[#1A1A1F]">
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2 border-b border-[#F5F5F7]/10 pb-6">
                <p className="text-[#9CA3AF] text-sm uppercase tracking-widest">
                  Heading Font - Bebas Neue
                </p>
                <h1 className="text-5xl font-heading text-white uppercase tracking-wide">
                  The quick brown fox jumps over the lazy dog
                </h1>
                <p className="text-[#9CA3AF] font-heading text-lg">
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[#9CA3AF] text-sm uppercase tracking-widest">
                  Body Font - Inter
                </p>
                <p className="text-lg text-white font-medium">
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-base text-[#9CA3AF]">
                  A slightly lighter, highly readable body font
                  designed for optimal clarity in digital
                  interfaces. Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk
                  Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
                  0123456789
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Components */}
        <section className="space-y-6">
          <h2 className="text-2xl font-heading text-[#FFC857] uppercase tracking-widest flex items-center gap-3 border-b border-[#F5F5F7]/10 pb-4">
            <Hand className="w-6 h-6" /> Interactive Elements
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-[#1A1A1F]">
              <CardHeader>
                <CardTitle className="text-[#9CA3AF] text-sm tracking-widest">
                  Buttons
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-4 items-center">
                  <Button variant="default">Primary CTA</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                </div>
                <div className="flex flex-wrap gap-4 items-center pt-4 border-t border-[#F5F5F7]/10">
                  <Button
                    size="lg"
                    className="font-heading tracking-widest uppercase"
                  >
                    Large Heading
                  </Button>
                  <Button size="sm">Small Size</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1F]">
              <CardHeader>
                <CardTitle className="text-[#9CA3AF] text-sm tracking-widest">
                  Inputs & Chips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Input placeholder="Enter your email address..." />
                  <Input
                    placeholder="Password"
                    type="password"
                  />
                </div>
                <div className="flex flex-wrap gap-3 pt-4 border-t border-[#F5F5F7]/10">
                  <Chip active>Selected State</Chip>
                  <Chip>Default State</Chip>
                  <Chip variant="outline">Outline</Chip>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* States & Overlays */}
        <section className="space-y-6">
          <h2 className="text-2xl font-heading text-[#FFC857] uppercase tracking-widest flex items-center gap-3 border-b border-[#F5F5F7]/10 pb-4">
            <LayoutGrid className="w-6 h-6" /> Cards & Overlays
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-[#1A1A1F] border-[#E50914] shadow-[0_0_30px_rgba(229,9,20,0.15)] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-[#E50914]/10 to-transparent pointer-events-none" />
              <CardContent className="p-6 relative z-10 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-[#E50914] flex items-center justify-center box-glow mb-4 text-white">
                  1
                </div>
                <h3 className="font-heading text-xl text-white uppercase tracking-wider">
                  Active State
                </h3>
                <p className="text-[#9CA3AF] text-sm mt-2">
                  Highlighted with signature red glow.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#1A1A1F] border-[#F5F5F7]/10 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-300">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-[#232329] border border-[#F5F5F7]/20 flex items-center justify-center mb-4 text-white">
                  2
                </div>
                <h3 className="font-heading text-xl text-white uppercase tracking-wider">
                  Hover State
                </h3>
                <p className="text-[#9CA3AF] text-sm mt-2">
                  Subtle lift and increased drop shadow.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#0B0B0D] border-[#F5F5F7]/5 opacity-50">
              <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <div className="w-12 h-12 rounded-full bg-[#1A1A1F] border border-[#F5F5F7]/10 flex items-center justify-center mb-4 text-[#9CA3AF]">
                  3
                </div>
                <h3 className="font-heading text-xl text-[#9CA3AF] uppercase tracking-wider">
                  Disabled State
                </h3>
                <p className="text-[#9CA3AF] text-sm mt-2">
                  Reduced opacity and deep black background.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function ColorSwatch({
  name,
  hex,
  className,
}: {
  name: string;
  hex: string;
  className?: string;
}) {
  return (
    <div className="space-y-3">
      <div
        className={`h-24 rounded-2xl shadow-lg w-full ${className}`}
      />
      <div>
        <p className="font-medium text-white">{name}</p>
        <p className="text-sm font-mono text-[#9CA3AF] uppercase">
          {hex}
        </p>
      </div>
    </div>
  );
}