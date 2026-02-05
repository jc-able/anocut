"use client";

import { Button } from "../ui/button";
import { ArrowRight, Mic, Sparkles, Scissors } from "lucide-react";
import Link from "next/link";

export function Hero() {
	return (
		<div className="flex min-h-[calc(100svh-4.5rem)] flex-col items-center justify-between px-4 text-center bg-background">
			<div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center">
				{/* Badge */}
				<div className="mb-8 flex justify-center">
					<div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-1.5 text-sm text-muted-foreground">
						<Sparkles className="size-4" />
						<span>AI-Powered Video Editing</span>
					</div>
				</div>

				{/* Main heading */}
				<h1 className="text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl">
					<span className="text-foreground">Edit videos with</span>
					<br />
					<span className="text-foreground">your voice</span>
				</h1>

				<p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg font-light tracking-wide md:text-xl">
					Annotate, command, and cut. AnoCut understands natural language so you can
					edit videos by simply describing what you want.
				</p>

				{/* Feature pills */}
				<div className="mt-8 flex flex-wrap justify-center gap-3">
					<div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
						<Mic className="size-4 text-muted-foreground" />
						<span>Voice Commands</span>
					</div>
					<div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
						<Sparkles className="size-4 text-muted-foreground" />
						<span>AI Annotations</span>
					</div>
					<div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 px-4 py-2 text-sm">
						<Scissors className="size-4 text-muted-foreground" />
						<span>Smart Cuts</span>
					</div>
				</div>

				{/* CTA button */}
				<div className="mt-10 flex justify-center">
					<Link href="/projects">
						<Button
							variant="foreground"
							size="lg"
							className="h-12 px-8 text-base"
						>
							Start Editing
							<ArrowRight className="ml-1 size-4" />
						</Button>
					</Link>
				</div>

				{/* Tagline */}
				<p className="mt-12 text-sm text-muted-foreground">
					<span className="font-medium text-foreground">Ano</span>tate + <span className="font-medium text-foreground">Cut</span> = AnoCut
				</p>
			</div>
		</div>
	);
}
